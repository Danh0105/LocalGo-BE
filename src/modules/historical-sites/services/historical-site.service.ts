import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type HistoricalSite,
  type Media,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  ReorderHistoricalSitesDto,
  UpdateHistoricalSiteStatusDto,
} from '../dto/historical-site-action.dto';
import {
  QueryHistoricalSiteAdminDto,
  QueryHistoricalSitePublicDto,
} from '../dto/query-historical-site.dto';
import {
  HistoricalSiteAdminResponseDto,
  HistoricalSiteListItemResponseDto,
  HistoricalSiteResponseDto,
} from '../dto/historical-site-response.dto';
import {
  CreateHistoricalSiteDto,
  UpdateHistoricalSiteDto,
} from '../dto/upsert-historical-site.dto';
import {
  HISTORICAL_SITE_RANK_FROM_DB,
  HISTORICAL_SITE_RANK_TO_DB,
} from '../historical-site.constants';

type HistoricalSiteRecord = HistoricalSite & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeHistoricalSite = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class HistoricalSiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryHistoricalSitePublicDto,
  ): Promise<HistoricalSiteListItemResponseDto[]> {
    const records = await this.prisma.historicalSite.findMany({
      where: {
        isActive: true,
        ...(query.rank ? { rank: HISTORICAL_SITE_RANK_TO_DB[query.rank] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeHistoricalSite,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<HistoricalSiteResponseDto> {
    const record = await this.prisma.historicalSite.findFirst({
      where: { id, isActive: true },
      include: includeHistoricalSite,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryHistoricalSiteAdminDto) {
    const where: Prisma.HistoricalSiteWhereInput = {
      ...(query.rank ? { rank: HISTORICAL_SITE_RANK_TO_DB[query.rank] } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.historicalSite.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeHistoricalSite,
      }),
      this.prisma.historicalSite.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<HistoricalSiteAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateHistoricalSiteDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.historicalSite.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.historicalSite.create({
        data: {
          id,
          name: dto.name,
          rank: HISTORICAL_SITE_RANK_TO_DB[dto.rank],
          address: dto.address,
          recognizedYear: dto.recognizedYear ?? null,
          summary: dto.summary,
          history: dto.history,
          highlights: dto.highlights,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeHistoricalSite,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'HISTORICAL_SITE_CREATED',
          resourceType: 'HistoricalSite',
          resourceId: id,
          newData: { version: 1 },
        },
      });
      return created;
    });
    return this.toAdminDto(record);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateHistoricalSiteDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.historicalSite.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            rank: HISTORICAL_SITE_RANK_TO_DB[dto.rank],
            address: dto.address,
            recognizedYear: dto.recognizedYear ?? null,
            summary: dto.summary,
            history: dto.history,
            highlights: dto.highlights,
            mediaId: dto.mediaId ?? null,
            imageAlt: dto.imageAlt,
            ...(dto.sortOrder === undefined
              ? {}
              : { sortOrder: dto.sortOrder }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (updated.count !== 1) throw await this.versionConflict(tx, id);

        const deletedMediaId = await this.mediaService.releaseSingularMedia(
          tx,
          {
            previousMediaId: current.mediaId,
            nextMediaId: dto.mediaId ?? null,
            resourceType: MediaResourceType.HISTORICAL_SITE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'HISTORICAL_SITE_UPDATED',
            resourceType: 'HistoricalSite',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.historicalSite.findUniqueOrThrow({
          where: { id },
          include: includeHistoricalSite,
        });
        return { record, deletedMediaId };
      },
    );
    await this.mediaService.purgeStorage([deletedMediaId]);
    return this.toAdminDto(record);
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateHistoricalSiteStatusDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.historicalSite.updateMany({
        where: { id, version: dto.version },
        data: {
          isActive: dto.isActive,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) throw await this.versionConflict(tx, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: dto.isActive
            ? 'HISTORICAL_SITE_SHOWN'
            : 'HISTORICAL_SITE_HIDDEN',
          resourceType: 'HistoricalSite',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.historicalSite.findUniqueOrThrow({
        where: { id },
        include: includeHistoricalSite,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderHistoricalSitesDto,
  ): Promise<HistoricalSiteAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.historicalSite.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.historicalSite.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'HISTORICAL_SITES_REORDERED',
          resourceType: 'HistoricalSite',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.historicalSite.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeHistoricalSite,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.historicalSite.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.HISTORICAL_SITE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'HISTORICAL_SITE_DELETED',
          resourceType: 'HistoricalSite',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<HistoricalSiteRecord> {
    const record = await this.prisma.historicalSite.findUnique({
      where: { id },
      include: includeHistoricalSite,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: HistoricalSiteRecord,
  ): HistoricalSiteListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      rank: HISTORICAL_SITE_RANK_FROM_DB[record.rank],
      address: record.address,
      recognizedYear: record.recognizedYear,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: HistoricalSiteRecord): HistoricalSiteResponseDto {
    return {
      ...this.toListDto(record),
      history: this.readStringArray(record.history),
      highlights: this.readStringArray(record.highlights),
    };
  }

  private toAdminDto(
    record: HistoricalSiteRecord,
  ): HistoricalSiteAdminResponseDto {
    return {
      ...this.toPublicDto(record),
      mediaId: record.mediaId,
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      createdBy: record.createdBy?.displayName ?? null,
      updatedBy: record.updatedBy?.displayName ?? null,
    };
  }

  private readStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    historicalSiteId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.HISTORICAL_SITE &&
          (media.resourceId === historicalSiteId ||
            media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_HISTORICAL_SITE_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    historicalSiteId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const claimed = await tx.media.updateMany({
      where: {
        id: mediaId,
        ownerId: actorId,
        resourceType: null,
        deletedAt: null,
      },
      data: {
        resourceType: MediaResourceType.HISTORICAL_SITE,
        resourceId: historicalSiteId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.HISTORICAL_SITE,
          OR: [{ resourceId: historicalSiteId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_HISTORICAL_SITE_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.historicalSite.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.historicalSite.findUnique({
      where: { id },
      include: includeHistoricalSite,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.HISTORICAL_SITE_VERSION_CONFLICT,
      'Di tích đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.HISTORICAL_SITE_NOT_FOUND,
      'Không tìm thấy di tích',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.HISTORICAL_SITE_SLUG_EXISTS,
      'Slug di tích đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
