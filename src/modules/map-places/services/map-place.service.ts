import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type MapPlace,
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
  ReorderMapPlacesDto,
  UpdateMapPlaceStatusDto,
} from '../dto/map-place-action.dto';
import {
  QueryMapPlaceAdminDto,
  QueryMapPlacePublicDto,
} from '../dto/query-map-place.dto';
import {
  MapPlaceAdminResponseDto,
  MapPlaceListItemResponseDto,
  MapPlaceResponseDto,
} from '../dto/map-place-response.dto';
import {
  CreateMapPlaceDto,
  UpdateMapPlaceDto,
} from '../dto/upsert-map-place.dto';
import {
  MAP_PLACE_CATEGORY_FROM_DB,
  MAP_PLACE_CATEGORY_TO_DB,
} from '../map-place.constants';

type MapPlaceRecord = MapPlace & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeMapPlace = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class MapPlaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryMapPlacePublicDto,
  ): Promise<MapPlaceListItemResponseDto[]> {
    const records = await this.prisma.mapPlace.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: MAP_PLACE_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeMapPlace,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<MapPlaceResponseDto> {
    const record = await this.prisma.mapPlace.findFirst({
      where: { id, isActive: true },
      include: includeMapPlace,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryMapPlaceAdminDto) {
    const where: Prisma.MapPlaceWhereInput = {
      ...(query.category
        ? { category: MAP_PLACE_CATEGORY_TO_DB[query.category] }
        : {}),
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
      this.prisma.mapPlace.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeMapPlace,
      }),
      this.prisma.mapPlace.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<MapPlaceAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateMapPlaceDto,
  ): Promise<MapPlaceAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.mapPlace.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.mapPlace.create({
        data: {
          id,
          name: dto.name,
          category: MAP_PLACE_CATEGORY_TO_DB[dto.category],
          address: dto.address,
          lat: dto.coordinates.lat,
          lng: dto.coordinates.lng,
          openTime: dto.openTime,
          distanceFromCenter: dto.distanceFromCenter,
          summary: dto.summary,
          description: dto.description,
          highlights: dto.highlights,
          directionNote: dto.directionNote,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeMapPlace,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'MAP_PLACE_CREATED',
          resourceType: 'MapPlace',
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
    dto: UpdateMapPlaceDto,
  ): Promise<MapPlaceAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.mapPlace.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: MAP_PLACE_CATEGORY_TO_DB[dto.category],
            address: dto.address,
            lat: dto.coordinates.lat,
            lng: dto.coordinates.lng,
            openTime: dto.openTime,
            distanceFromCenter: dto.distanceFromCenter,
            summary: dto.summary,
            description: dto.description,
            highlights: dto.highlights,
            directionNote: dto.directionNote,
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
            resourceType: MediaResourceType.MAP_PLACE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'MAP_PLACE_UPDATED',
            resourceType: 'MapPlace',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.mapPlace.findUniqueOrThrow({
          where: { id },
          include: includeMapPlace,
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
    dto: UpdateMapPlaceStatusDto,
  ): Promise<MapPlaceAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mapPlace.updateMany({
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
          action: dto.isActive ? 'MAP_PLACE_SHOWN' : 'MAP_PLACE_HIDDEN',
          resourceType: 'MapPlace',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.mapPlace.findUniqueOrThrow({
        where: { id },
        include: includeMapPlace,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderMapPlacesDto,
  ): Promise<MapPlaceAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.mapPlace.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.mapPlace.update({
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
          action: 'MAP_PLACES_REORDERED',
          resourceType: 'MapPlace',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.mapPlace.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeMapPlace,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.mapPlace.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.MAP_PLACE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'MAP_PLACE_DELETED',
          resourceType: 'MapPlace',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<MapPlaceRecord> {
    const record = await this.prisma.mapPlace.findUnique({
      where: { id },
      include: includeMapPlace,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: MapPlaceRecord): MapPlaceListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: MAP_PLACE_CATEGORY_FROM_DB[record.category],
      address: record.address,
      coordinates: {
        lat: Number(record.lat),
        lng: Number(record.lng),
      },
      openTime: record.openTime,
      distanceFromCenter: record.distanceFromCenter,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: MapPlaceRecord): MapPlaceResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      highlights: this.readStringArray(record.highlights),
      directionNote: record.directionNote,
    };
  }

  private toAdminDto(record: MapPlaceRecord): MapPlaceAdminResponseDto {
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
    mapPlaceId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.MAP_PLACE &&
          (media.resourceId === mapPlaceId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_MAP_PLACE_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    mapPlaceId: string,
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
        resourceType: MediaResourceType.MAP_PLACE,
        resourceId: mapPlaceId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.MAP_PLACE,
          OR: [{ resourceId: mapPlaceId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_MAP_PLACE_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.mapPlace.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.mapPlace.findUnique({
      where: { id },
      include: includeMapPlace,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.MAP_PLACE_VERSION_CONFLICT,
      'Điểm bản đồ đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.MAP_PLACE_NOT_FOUND,
      'Không tìm thấy điểm bản đồ',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.MAP_PLACE_SLUG_EXISTS,
      'Slug điểm bản đồ đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
