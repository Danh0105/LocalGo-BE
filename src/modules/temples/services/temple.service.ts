import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Media,
  type Temple,
  type TempleEvent,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  ReorderTemplesDto,
  UpdateTempleStatusDto,
} from '../dto/temple-action.dto';
import {
  QueryTempleAdminDto,
  QueryTemplePublicDto,
} from '../dto/query-temple.dto';
import {
  TempleAdminResponseDto,
  TempleListItemResponseDto,
  TempleResponseDto,
} from '../dto/temple-response.dto';
import { CreateTempleDto, UpdateTempleDto } from '../dto/upsert-temple.dto';
import { TEMPLE_TYPE_FROM_DB, TEMPLE_TYPE_TO_DB } from '../temple.constants';

type TempleRecord = Temple & {
  events: TempleEvent[];
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeTemple = {
  events: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class TempleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryTemplePublicDto,
  ): Promise<TempleListItemResponseDto[]> {
    const records = await this.prisma.temple.findMany({
      where: {
        isActive: true,
        ...(query.type ? { type: TEMPLE_TYPE_TO_DB[query.type] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeTemple,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<TempleResponseDto> {
    const record = await this.prisma.temple.findFirst({
      where: { id, isActive: true },
      include: includeTemple,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryTempleAdminDto) {
    const where: Prisma.TempleWhereInput = {
      ...(query.type ? { type: TEMPLE_TYPE_TO_DB[query.type] } : {}),
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
      this.prisma.temple.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeTemple,
      }),
      this.prisma.temple.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<TempleAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateTempleDto,
  ): Promise<TempleAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.temple.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);
    this.validateEventIds(dto.events);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.temple.create({
        data: {
          id,
          name: dto.name,
          type: TEMPLE_TYPE_TO_DB[dto.type],
          address: dto.address,
          openHours: dto.openHours,
          summary: dto.summary,
          description: dto.description,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
          events: {
            create: dto.events.map((event, index) => ({
              ...(event.id ? { id: event.id } : {}),
              time: event.time,
              name: event.name,
              sortOrder: index,
            })),
          },
        },
        include: includeTemple,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TEMPLE_CREATED',
          resourceType: 'Temple',
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
    dto: UpdateTempleDto,
  ): Promise<TempleAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);
    this.validateEventIds(dto.events);
    const suppliedIds = dto.events.flatMap((event) =>
      event.id ? [event.id] : [],
    );
    const ownedIds = new Set(current.events.map((event) => event.id));
    if (suppliedIds.some((eventId) => !ownedIds.has(eventId))) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Sự kiện không thuộc điểm du lịch này',
      );
    }

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.temple.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            type: TEMPLE_TYPE_TO_DB[dto.type],
            address: dto.address,
            openHours: dto.openHours,
            summary: dto.summary,
            description: dto.description,
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

        await tx.templeEvent.deleteMany({
          where: {
            templeId: id,
            ...(suppliedIds.length ? { id: { notIn: suppliedIds } } : {}),
          },
        });
        for (const [index, event] of dto.events.entries()) {
          if (event.id) {
            await tx.templeEvent.update({
              where: { id: event.id },
              data: { time: event.time, name: event.name, sortOrder: index },
            });
          } else {
            await tx.templeEvent.create({
              data: {
                templeId: id,
                time: event.time,
                name: event.name,
                sortOrder: index,
              },
            });
          }
        }
        const deletedMediaId = await this.mediaService.releaseSingularMedia(
          tx,
          {
            previousMediaId: current.mediaId,
            nextMediaId: dto.mediaId ?? null,
            resourceType: MediaResourceType.TEMPLE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'TEMPLE_UPDATED',
            resourceType: 'Temple',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.temple.findUniqueOrThrow({
          where: { id },
          include: includeTemple,
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
    dto: UpdateTempleStatusDto,
  ): Promise<TempleAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.temple.updateMany({
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
          action: dto.isActive ? 'TEMPLE_SHOWN' : 'TEMPLE_HIDDEN',
          resourceType: 'Temple',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.temple.findUniqueOrThrow({
        where: { id },
        include: includeTemple,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderTemplesDto,
  ): Promise<TempleAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.temple.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.temple.update({
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
          action: 'TEMPLES_REORDERED',
          resourceType: 'Temple',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.temple.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeTemple,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.temple.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.TEMPLE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TEMPLE_DELETED',
          resourceType: 'Temple',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<TempleRecord> {
    const record = await this.prisma.temple.findUnique({
      where: { id },
      include: includeTemple,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: TempleRecord): TempleListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      type: TEMPLE_TYPE_FROM_DB[record.type],
      address: record.address,
      openHours: record.openHours,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: TempleRecord): TempleResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readDescription(record.description),
      events: record.events.map(({ id, time, name }) => ({ id, time, name })),
    };
  }

  private toAdminDto(record: TempleRecord): TempleAdminResponseDto {
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

  private readDescription(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private validateEventIds(events: Array<{ id?: string | null }>): void {
    const ids = events.flatMap((event) => (event.id ? [event.id] : []));
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sự kiện chứa ID trùng',
      );
    }
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    templeId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.TEMPLE &&
          (media.resourceId === templeId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_TEMPLE_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    templeId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const claimed = await tx.media.updateMany({
      where: {
        id: mediaId,
        ownerId: actorId,
        resourceType: null,
        deletedAt: null,
      },
      data: { resourceType: MediaResourceType.TEMPLE, resourceId: templeId },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.TEMPLE,
          OR: [{ resourceId: templeId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_TEMPLE_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.temple.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.temple.findUnique({
      where: { id },
      include: includeTemple,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.TEMPLE_VERSION_CONFLICT,
      'Điểm du lịch đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.TEMPLE_NOT_FOUND,
      'Không tìm thấy điểm du lịch',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.TEMPLE_SLUG_EXISTS,
      'Slug điểm du lịch đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
