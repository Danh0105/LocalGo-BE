import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type CuisineItem,
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
  ReorderCuisineItemsDto,
  UpdateCuisineItemStatusDto,
} from '../dto/cuisine-action.dto';
import {
  QueryCuisineAdminDto,
  QueryCuisinePublicDto,
} from '../dto/query-cuisine.dto';
import {
  CuisineAdminResponseDto,
  CuisineListItemResponseDto,
  CuisineResponseDto,
} from '../dto/cuisine-response.dto';
import {
  CreateCuisineItemDto,
  UpdateCuisineItemDto,
  type CuisineContentDto,
} from '../dto/upsert-cuisine.dto';
import {
  CUISINE_CATEGORY_FROM_DB,
  CUISINE_CATEGORY_TO_DB,
} from '../cuisine.constants';
import {
  parseSuggestedPlaceDetails,
  type CuisineSuggestedPlace,
} from '../utils/suggested-place.util';

type CuisineItemRecord = CuisineItem & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeCuisineItem = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class CuisineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryCuisinePublicDto,
  ): Promise<CuisineListItemResponseDto[]> {
    const records = await this.prisma.cuisineItem.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: CUISINE_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeCuisineItem,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<CuisineResponseDto> {
    const record = await this.prisma.cuisineItem.findFirst({
      where: { id, isActive: true },
      include: includeCuisineItem,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryCuisineAdminDto) {
    const where: Prisma.CuisineItemWhereInput = {
      ...(query.category
        ? { category: CUISINE_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.cuisineItem.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeCuisineItem,
      }),
      this.prisma.cuisineItem.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<CuisineAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateCuisineItemDto,
  ): Promise<CuisineAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.cuisineItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);
    const places = this.resolveSuggestedPlaces(dto, id);
    this.assertSuggestedPlacesForActive(dto.isActive ?? true, places);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.cuisineItem.create({
        data: {
          id,
          name: dto.name,
          category: CUISINE_CATEGORY_TO_DB[dto.category],
          priceRange: dto.priceRange,
          bestTime: dto.bestTime,
          suggestedPlaces: places as unknown as Prisma.InputJsonValue,
          summary: dto.summary,
          description: dto.description,
          highlights: dto.highlights,
          tip: dto.tip,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeCuisineItem,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUISINE_ITEM_CREATED',
          resourceType: 'CuisineItem',
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
    dto: UpdateCuisineItemDto,
  ): Promise<CuisineAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);
    const places = this.resolveSuggestedPlaces(dto, id);
    this.assertSuggestedPlacesForActive(
      dto.isActive ?? current.isActive,
      places,
    );

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.cuisineItem.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: CUISINE_CATEGORY_TO_DB[dto.category],
            priceRange: dto.priceRange,
            bestTime: dto.bestTime,
            suggestedPlaces: places as unknown as Prisma.InputJsonValue,
            summary: dto.summary,
            description: dto.description,
            highlights: dto.highlights,
            tip: dto.tip,
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
            resourceType: MediaResourceType.CUISINE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CUISINE_ITEM_UPDATED',
            resourceType: 'CuisineItem',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.cuisineItem.findUniqueOrThrow({
          where: { id },
          include: includeCuisineItem,
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
    dto: UpdateCuisineItemStatusDto,
  ): Promise<CuisineAdminResponseDto> {
    if (dto.isActive) {
      const current = await this.findOrThrow(id);
      this.assertSuggestedPlacesForActive(
        true,
        parseSuggestedPlaceDetails(current.suggestedPlaces, id),
      );
    }
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cuisineItem.updateMany({
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
          action: dto.isActive ? 'CUISINE_ITEM_SHOWN' : 'CUISINE_ITEM_HIDDEN',
          resourceType: 'CuisineItem',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.cuisineItem.findUniqueOrThrow({
        where: { id },
        include: includeCuisineItem,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderCuisineItemsDto,
  ): Promise<CuisineAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.cuisineItem.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.cuisineItem.update({
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
          action: 'CUISINE_ITEMS_REORDERED',
          resourceType: 'CuisineItem',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.cuisineItem.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeCuisineItem,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.cuisineItem.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.CUISINE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUISINE_ITEM_DELETED',
          resourceType: 'CuisineItem',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<CuisineItemRecord> {
    const record = await this.prisma.cuisineItem.findUnique({
      where: { id },
      include: includeCuisineItem,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: CuisineItemRecord): CuisineListItemResponseDto {
    const places = parseSuggestedPlaceDetails(
      record.suggestedPlaces,
      record.id,
    );
    return {
      id: record.id,
      name: record.name,
      category: CUISINE_CATEGORY_FROM_DB[record.category],
      priceRange: record.priceRange,
      bestTime: record.bestTime,
      suggestedPlaces: places.map((place) => place.name),
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: CuisineItemRecord): CuisineResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      highlights: this.readStringArray(record.highlights),
      tip: record.tip,
      suggestedPlaceDetails: parseSuggestedPlaceDetails(
        record.suggestedPlaces,
        record.id,
      ),
    };
  }

  private toAdminDto(record: CuisineItemRecord): CuisineAdminResponseDto {
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

  private resolveSuggestedPlaces(
    dto: Pick<CuisineContentDto, 'suggestedPlaceDetails' | 'suggestedPlaces'>,
    cuisineItemId: string,
  ): CuisineSuggestedPlace[] {
    let places: CuisineSuggestedPlace[];
    if (dto.suggestedPlaceDetails) {
      places = dto.suggestedPlaceDetails.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address ?? '',
        googleMapsUrl: place.googleMapsUrl ?? '',
      }));
      const ids = places.map((place) => place.id);
      if (new Set(ids).size !== ids.length) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'Danh sách địa điểm gợi ý chứa ID trùng',
        );
      }
    } else if (dto.suggestedPlaces) {
      places = parseSuggestedPlaceDetails(dto.suggestedPlaces, cuisineItemId);
    } else {
      places = [];
    }
    return places;
  }

  private assertSuggestedPlacesForActive(
    isActive: boolean,
    places: CuisineSuggestedPlace[],
  ): void {
    if (!isActive) return;
    for (const place of places) {
      if (!place.address?.trim() || !place.googleMapsUrl?.trim()) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          `Địa điểm gợi ý "${place.name}" cần có địa chỉ và link Google Maps trước khi hiển thị món này`,
        );
      }
    }
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    cuisineItemId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.CUISINE &&
          (media.resourceId === cuisineItemId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_CUISINE_ITEM_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    cuisineItemId: string,
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
        resourceType: MediaResourceType.CUISINE,
        resourceId: cuisineItemId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.CUISINE,
          OR: [{ resourceId: cuisineItemId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_CUISINE_ITEM_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.cuisineItem.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.cuisineItem.findUnique({
      where: { id },
      include: includeCuisineItem,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.CUISINE_ITEM_VERSION_CONFLICT,
      'Món ăn đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.CUISINE_ITEM_NOT_FOUND,
      'Không tìm thấy món ăn',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.CUISINE_ITEM_SLUG_EXISTS,
      'Slug món ăn đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
