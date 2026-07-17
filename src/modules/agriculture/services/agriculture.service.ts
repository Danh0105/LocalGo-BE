import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type AgricultureItem,
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
  ReorderAgricultureItemsDto,
  UpdateAgricultureItemStatusDto,
} from '../dto/agriculture-action.dto';
import {
  QueryAgricultureAdminDto,
  QueryAgriculturePublicDto,
} from '../dto/query-agriculture.dto';
import {
  AgricultureAdminResponseDto,
  AgricultureListItemResponseDto,
  AgricultureResponseDto,
} from '../dto/agriculture-response.dto';
import {
  CreateAgricultureItemDto,
  UpdateAgricultureItemDto,
} from '../dto/upsert-agriculture.dto';
import {
  AGRICULTURE_CATEGORY_FROM_DB,
  AGRICULTURE_CATEGORY_TO_DB,
} from '../agriculture.constants';

type AgricultureItemRecord = AgricultureItem & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeAgricultureItem = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class AgricultureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryAgriculturePublicDto,
  ): Promise<AgricultureListItemResponseDto[]> {
    const records = await this.prisma.agricultureItem.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: AGRICULTURE_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeAgricultureItem,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<AgricultureResponseDto> {
    const record = await this.prisma.agricultureItem.findFirst({
      where: { id, isActive: true },
      include: includeAgricultureItem,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryAgricultureAdminDto) {
    const where: Prisma.AgricultureItemWhereInput = {
      ...(query.category
        ? { category: AGRICULTURE_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.agricultureItem.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeAgricultureItem,
      }),
      this.prisma.agricultureItem.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<AgricultureAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateAgricultureItemDto,
  ): Promise<AgricultureAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.agricultureItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.agricultureItem.create({
        data: {
          id,
          name: dto.name,
          category: AGRICULTURE_CATEGORY_TO_DB[dto.category],
          location: dto.location,
          season: dto.season,
          scale: dto.scale,
          summary: dto.summary,
          description: dto.description,
          highlights: dto.highlights,
          support: dto.support,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeAgricultureItem,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'AGRICULTURE_ITEM_CREATED',
          resourceType: 'AgricultureItem',
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
    dto: UpdateAgricultureItemDto,
  ): Promise<AgricultureAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.agricultureItem.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: AGRICULTURE_CATEGORY_TO_DB[dto.category],
            location: dto.location,
            season: dto.season,
            scale: dto.scale,
            summary: dto.summary,
            description: dto.description,
            highlights: dto.highlights,
            support: dto.support,
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
            resourceType: MediaResourceType.AGRICULTURE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'AGRICULTURE_ITEM_UPDATED',
            resourceType: 'AgricultureItem',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.agricultureItem.findUniqueOrThrow({
          where: { id },
          include: includeAgricultureItem,
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
    dto: UpdateAgricultureItemStatusDto,
  ): Promise<AgricultureAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.agricultureItem.updateMany({
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
            ? 'AGRICULTURE_ITEM_SHOWN'
            : 'AGRICULTURE_ITEM_HIDDEN',
          resourceType: 'AgricultureItem',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.agricultureItem.findUniqueOrThrow({
        where: { id },
        include: includeAgricultureItem,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderAgricultureItemsDto,
  ): Promise<AgricultureAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.agricultureItem.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.agricultureItem.update({
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
          action: 'AGRICULTURE_ITEMS_REORDERED',
          resourceType: 'AgricultureItem',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.agricultureItem.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeAgricultureItem,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.agricultureItem.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.AGRICULTURE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'AGRICULTURE_ITEM_DELETED',
          resourceType: 'AgricultureItem',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<AgricultureItemRecord> {
    const record = await this.prisma.agricultureItem.findUnique({
      where: { id },
      include: includeAgricultureItem,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: AgricultureItemRecord,
  ): AgricultureListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: AGRICULTURE_CATEGORY_FROM_DB[record.category],
      location: record.location,
      season: record.season,
      scale: record.scale,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: AgricultureItemRecord): AgricultureResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      highlights: this.readStringArray(record.highlights),
      support: record.support,
    };
  }

  private toAdminDto(
    record: AgricultureItemRecord,
  ): AgricultureAdminResponseDto {
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
    agricultureItemId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.AGRICULTURE &&
          (media.resourceId === agricultureItemId ||
            media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_AGRICULTURE_ITEM_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    agricultureItemId: string,
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
        resourceType: MediaResourceType.AGRICULTURE,
        resourceId: agricultureItemId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.AGRICULTURE,
          OR: [{ resourceId: agricultureItemId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_AGRICULTURE_ITEM_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.agricultureItem.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.agricultureItem.findUnique({
      where: { id },
      include: includeAgricultureItem,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.AGRICULTURE_ITEM_VERSION_CONFLICT,
      'Mục nông nghiệp đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.AGRICULTURE_ITEM_NOT_FOUND,
      'Không tìm thấy mục nông nghiệp',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.AGRICULTURE_ITEM_SLUG_EXISTS,
      'Slug mục nông nghiệp đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
