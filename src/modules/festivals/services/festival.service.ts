import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Festival,
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
  ReorderFestivalsDto,
  UpdateFestivalStatusDto,
} from '../dto/festival-action.dto';
import {
  QueryFestivalAdminDto,
  QueryFestivalPublicDto,
} from '../dto/query-festival.dto';
import {
  FestivalAdminResponseDto,
  FestivalListItemResponseDto,
  FestivalResponseDto,
} from '../dto/festival-response.dto';
import {
  CreateFestivalDto,
  UpdateFestivalDto,
} from '../dto/upsert-festival.dto';
import {
  FESTIVAL_CATEGORY_FROM_DB,
  FESTIVAL_CATEGORY_TO_DB,
} from '../festival.constants';

type FestivalRecord = Festival & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeFestival = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class FestivalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryFestivalPublicDto,
  ): Promise<FestivalListItemResponseDto[]> {
    const records = await this.prisma.festival.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: FESTIVAL_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeFestival,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<FestivalResponseDto> {
    const record = await this.prisma.festival.findFirst({
      where: { id, isActive: true },
      include: includeFestival,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryFestivalAdminDto) {
    const where: Prisma.FestivalWhereInput = {
      ...(query.category
        ? { category: FESTIVAL_CATEGORY_TO_DB[query.category] }
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
      this.prisma.festival.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeFestival,
      }),
      this.prisma.festival.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<FestivalAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateFestivalDto,
  ): Promise<FestivalAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.festival.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.festival.create({
        data: {
          id,
          name: dto.name,
          category: FESTIVAL_CATEGORY_TO_DB[dto.category],
          time: dto.time,
          location: dto.location,
          scale: dto.scale,
          summary: dto.summary,
          description: dto.description,
          activities: dto.activities,
          note: dto.note,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeFestival,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FESTIVAL_CREATED',
          resourceType: 'Festival',
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
    dto: UpdateFestivalDto,
  ): Promise<FestivalAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.festival.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: FESTIVAL_CATEGORY_TO_DB[dto.category],
            time: dto.time,
            location: dto.location,
            scale: dto.scale,
            summary: dto.summary,
            description: dto.description,
            activities: dto.activities,
            note: dto.note,
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
            resourceType: MediaResourceType.FESTIVAL,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'FESTIVAL_UPDATED',
            resourceType: 'Festival',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.festival.findUniqueOrThrow({
          where: { id },
          include: includeFestival,
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
    dto: UpdateFestivalStatusDto,
  ): Promise<FestivalAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.festival.updateMany({
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
          action: dto.isActive ? 'FESTIVAL_SHOWN' : 'FESTIVAL_HIDDEN',
          resourceType: 'Festival',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.festival.findUniqueOrThrow({
        where: { id },
        include: includeFestival,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderFestivalsDto,
  ): Promise<FestivalAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.festival.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.festival.update({
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
          action: 'FESTIVALS_REORDERED',
          resourceType: 'Festival',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.festival.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeFestival,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.festival.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.FESTIVAL,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FESTIVAL_DELETED',
          resourceType: 'Festival',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<FestivalRecord> {
    const record = await this.prisma.festival.findUnique({
      where: { id },
      include: includeFestival,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: FestivalRecord): FestivalListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: FESTIVAL_CATEGORY_FROM_DB[record.category],
      time: record.time,
      location: record.location,
      scale: record.scale,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: FestivalRecord): FestivalResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      activities: this.readStringArray(record.activities),
      note: record.note,
    };
  }

  private toAdminDto(record: FestivalRecord): FestivalAdminResponseDto {
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
    festivalId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.FESTIVAL &&
          (media.resourceId === festivalId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_FESTIVAL_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    festivalId: string,
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
        resourceType: MediaResourceType.FESTIVAL,
        resourceId: festivalId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.FESTIVAL,
          OR: [{ resourceId: festivalId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_FESTIVAL_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.festival.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.festival.findUnique({
      where: { id },
      include: includeFestival,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.FESTIVAL_VERSION_CONFLICT,
      'Lễ hội đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.FESTIVAL_NOT_FOUND,
      'Không tìm thấy lễ hội',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.FESTIVAL_SLUG_EXISTS,
      'Slug lễ hội đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
