import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ContentReviewTargetType,
  MediaResourceType,
  MapLocationSource,
  Prisma,
  type CuisineItemImage,
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
import { ContentReviewService } from '../../content-reviews/services/content-review.service';
import {
  MapLocationService,
  type MapLocationLookup,
} from '../../map-location/map-location.service';
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
  parseCuisineMenu,
  parseCuisineReviews,
  type CuisineMenuItem,
  type CuisineReview,
} from '../utils/cuisine-details.util';
import {
  parseSuggestedPlaceDetails,
  type CuisineSuggestedPlace,
} from '../utils/suggested-place.util';

type CuisineItemRecord = CuisineItem & {
  media: Media | null;
  galleryImages: Array<CuisineItemImage & { media: Media }>;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeCuisineItem = {
  media: true,
  galleryImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: { media: true },
  },
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class CuisineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly contentReviews: ContentReviewService,
    private readonly mapLocations: MapLocationService,
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
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      records.map(({ id }) => id),
    );
    return records.map((record) => this.toListDto(record, locations));
  }

  async publicDetail(id: string): Promise<CuisineResponseDto> {
    const record = await this.prisma.cuisineItem.findFirst({
      where: { id, isActive: true },
      include: includeCuisineItem,
    });
    if (!record) throw this.notFound();
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [record.id],
    );
    return this.toPublicDto(record, locations);
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
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      records.map(({ id }) => id),
    );
    return paginate(
      records.map((record) => this.toAdminDto(record, locations)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<CuisineAdminResponseDto> {
    const record = await this.findOrThrow(id);
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [id],
    );
    return this.toAdminDto(record, locations);
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
    const galleryMediaIds = dto.galleryMediaIds ?? [];
    this.assertDistinctCuisineMedia(dto.mediaId, galleryMediaIds);
    await this.validateMediaSet([dto.mediaId, ...galleryMediaIds], actorId, id);
    const places = this.resolveSuggestedPlaces(dto, id);
    const menu = this.resolveMenu(dto.menu);
    const reviews = this.resolveReviews(dto.reviews);
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
          googleMapsUrl: dto.googleMapsUrl ?? '',
          suggestedPlaces: places as unknown as Prisma.InputJsonValue,
          summary: dto.summary,
          description: dto.description,
          highlights: dto.highlights,
          tip: dto.tip,
          contactPhone: dto.contactPhone ?? '',
          menu: menu as unknown as Prisma.InputJsonValue,
          reviews: reviews as unknown as Prisma.InputJsonValue,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
          ...(galleryMediaIds.length === 0
            ? {}
            : {
                galleryImages: {
                  create: galleryMediaIds.map((mediaId, index) => ({
                    mediaId,
                    sortOrder: index,
                  })),
                },
              }),
        },
        include: includeCuisineItem,
      });
      await this.claimMediaSet(
        tx,
        [dto.mediaId, ...galleryMediaIds],
        actorId,
        id,
      );
      await this.mapLocations.syncCuisine(
        tx,
        id,
        dto.googleMapsUrl ?? '',
        places,
      );
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
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [id],
    );
    return this.toAdminDto(record, locations);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateCuisineItemDto,
  ): Promise<CuisineAdminResponseDto> {
    const current = await this.findOrThrow(id);
    const galleryMediaIds =
      dto.galleryMediaIds ??
      current.galleryImages.map((image) => image.mediaId);
    this.assertDistinctCuisineMedia(dto.mediaId, galleryMediaIds);
    await this.validateMediaSet([dto.mediaId, ...galleryMediaIds], actorId, id);
    const places = this.resolveSuggestedPlaces(dto, id);
    this.assertSuggestedPlacesForActive(
      dto.isActive ?? current.isActive,
      places,
    );

    const { record, deletedMediaIds } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.cuisineItem.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: CUISINE_CATEGORY_TO_DB[dto.category],
            priceRange: dto.priceRange,
            bestTime: dto.bestTime,
            ...(dto.googleMapsUrl === undefined
              ? {}
              : { googleMapsUrl: dto.googleMapsUrl }),
            suggestedPlaces: places as unknown as Prisma.InputJsonValue,
            summary: dto.summary,
            description: dto.description,
            highlights: dto.highlights,
            tip: dto.tip,
            ...(dto.contactPhone === undefined
              ? {}
              : { contactPhone: dto.contactPhone }),
            ...(dto.menu === undefined
              ? {}
              : {
                  menu: this.resolveMenu(
                    dto.menu,
                  ) as unknown as Prisma.InputJsonValue,
                }),
            ...(dto.reviews === undefined
              ? {}
              : {
                  reviews: this.resolveReviews(
                    dto.reviews,
                  ) as unknown as Prisma.InputJsonValue,
                }),
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

        if (dto.galleryMediaIds !== undefined) {
          await tx.cuisineItemImage.deleteMany({
            where: { cuisineItemId: id },
          });
          if (galleryMediaIds.length > 0) {
            await tx.cuisineItemImage.createMany({
              data: galleryMediaIds.map((mediaId, index) => ({
                cuisineItemId: id,
                mediaId,
                sortOrder: index,
              })),
            });
          }
        }

        await this.claimMediaSet(
          tx,
          [dto.mediaId, ...galleryMediaIds],
          actorId,
          id,
        );
        const previousMediaIds = [
          current.mediaId,
          ...current.galleryImages.map((image) => image.mediaId),
        ].filter((mediaId): mediaId is string => !!mediaId);
        const nextMediaIds = new Set(
          [dto.mediaId, ...galleryMediaIds].filter(
            (mediaId): mediaId is string => !!mediaId,
          ),
        );
        const removedMediaIds = previousMediaIds.filter(
          (mediaId) => !nextMediaIds.has(mediaId),
        );
        const releasable =
          removedMediaIds.length === 0
            ? []
            : await tx.media.findMany({
                where: {
                  id: { in: removedMediaIds },
                  resourceType: MediaResourceType.CUISINE,
                  resourceId: id,
                  deletedAt: null,
                },
                select: { id: true },
              });
        const deletedMediaIds = releasable.map(({ id: mediaId }) => mediaId);
        if (deletedMediaIds.length > 0) {
          await tx.media.updateMany({
            where: { id: { in: deletedMediaIds } },
            data: {
              resourceType: null,
              resourceId: null,
              deletedAt: new Date(),
            },
          });
        }
        await this.mapLocations.syncCuisine(
          tx,
          id,
          dto.googleMapsUrl ?? current.googleMapsUrl,
          places,
        );
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
        return { record, deletedMediaIds };
      },
    );
    await this.mediaService.purgeStorage(deletedMediaIds);
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [id],
    );
    return this.toAdminDto(record, locations);
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
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [id],
    );
    return this.toAdminDto(record, locations);
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
    const records = await this.prisma.$transaction(async (tx) => {
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
      return records;
    });
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      records.map(({ id }) => id),
    );
    return records.map((record) => this.toAdminDto(record, locations));
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaIds = await this.prisma.$transaction(async (tx) => {
      const candidateIds = [
        current.mediaId,
        ...current.galleryImages.map((image) => image.mediaId),
      ].filter((mediaId): mediaId is string => !!mediaId);
      const claimedMedia = await tx.media.findMany({
        where: {
          id: { in: candidateIds },
          resourceType: MediaResourceType.CUISINE,
          resourceId: id,
          deletedAt: null,
        },
        select: { id: true },
      });
      await tx.cuisineItem.delete({ where: { id } });
      const reviewMediaIds = await this.contentReviews.deleteForRecord(
        tx,
        ContentReviewTargetType.CUISINE,
        id,
      );
      await this.mapLocations.deleteForRecord(
        tx,
        MapLocationSource.CUISINE,
        id,
      );
      const claimedIds = claimedMedia.map(({ id: mediaId }) => mediaId);
      if (claimedIds.length > 0) {
        await tx.media.updateMany({
          where: { id: { in: claimedIds } },
          data: {
            resourceType: null,
            resourceId: null,
            deletedAt: new Date(),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUISINE_ITEM_DELETED',
          resourceType: 'CuisineItem',
          resourceId: id,
        },
      });
      return [...claimedIds, ...reviewMediaIds];
    });
    await this.mediaService.purgeStorage(deletedMediaIds);
  }

  private async findOrThrow(id: string): Promise<CuisineItemRecord> {
    const record = await this.prisma.cuisineItem.findUnique({
      where: { id },
      include: includeCuisineItem,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: CuisineItemRecord,
    locations: Map<string, MapLocationLookup>,
  ): CuisineListItemResponseDto {
    const places = parseSuggestedPlaceDetails(
      record.suggestedPlaces,
      record.id,
    );
    const reviews = parseCuisineReviews(record.reviews, record.id);
    const averageRating =
      reviews.length === 0
        ? 0
        : Number(
            (
              reviews.reduce((total, review) => total + review.rating, 0) /
              reviews.length
            ).toFixed(1),
          );
    return {
      id: record.id,
      name: record.name,
      category: CUISINE_CATEGORY_FROM_DB[record.category],
      priceRange: record.priceRange,
      bestTime: record.bestTime,
      googleMapsUrl: record.googleMapsUrl,
      mapLocation: this.mapLocations.getFromMap(
        locations,
        MapLocationSource.CUISINE,
        record.id,
        '',
        record.googleMapsUrl,
      ),
      suggestedPlaces: places.map((place) => place.name),
      suggestedPlaceDetails: places.map((place) => ({
        ...place,
        mapLocation: this.mapLocations.getFromMap(
          locations,
          MapLocationSource.CUISINE,
          record.id,
          place.id,
          place.googleMapsUrl,
        ),
      })),
      summary: record.summary,
      averageRating,
      reviewCount: reviews.length,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(
    record: CuisineItemRecord,
    locations: Map<string, MapLocationLookup>,
  ): CuisineResponseDto {
    return {
      ...this.toListDto(record, locations),
      description: this.readStringArray(record.description),
      highlights: this.readStringArray(record.highlights),
      tip: record.tip,
      contactPhone: record.contactPhone,
      menu: parseCuisineMenu(record.menu, record.id),
      reviews: parseCuisineReviews(record.reviews, record.id),
      galleryImages: record.galleryImages.map((image) => ({
        mediaId: image.mediaId,
        imageUrl: image.media.originalUrl,
        thumbnailUrl: image.media.thumbnailUrl,
        sortOrder: image.sortOrder,
      })),
    };
  }

  private toAdminDto(
    record: CuisineItemRecord,
    locations: Map<string, MapLocationLookup>,
  ): CuisineAdminResponseDto {
    return {
      ...this.toPublicDto(record, locations),
      mediaId: record.mediaId,
      galleryMediaIds: record.galleryImages.map((image) => image.mediaId),
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

  private resolveMenu(items: CuisineContentDto['menu']): CuisineMenuItem[] {
    const menu = (items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description ?? '',
    }));
    this.assertUniqueContentIds(
      menu.map((item) => item.id),
      'Menu chứa ID món trùng',
    );
    return menu;
  }

  private resolveReviews(items: CuisineContentDto['reviews']): CuisineReview[] {
    const reviews = (items ?? []).map((item) => ({
      id: item.id,
      reviewerName: item.reviewerName,
      rating: item.rating,
      feedback: item.feedback,
      adminResponse: item.adminResponse ?? '',
    }));
    this.assertUniqueContentIds(
      reviews.map((review) => review.id),
      'Danh sách đánh giá chứa ID trùng',
    );
    return reviews;
  }

  private assertUniqueContentIds(ids: string[], message: string): void {
    if (new Set(ids).size !== ids.length) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, message);
    }
  }

  private assertDistinctCuisineMedia(
    mediaId: string | null | undefined,
    galleryMediaIds: string[],
  ): void {
    if (mediaId && galleryMediaIds.includes(mediaId)) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Ảnh chính không được trùng với ảnh phụ',
      );
    }
  }

  private async validateMediaSet(
    mediaIds: Array<string | null | undefined>,
    actorId: string,
    cuisineItemId: string,
  ): Promise<void> {
    const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    const mediaRecords = await this.prisma.media.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
    const validIds = new Set(
      mediaRecords
        .filter(
          (media) =>
            media.mimeType.startsWith('image/') &&
            ((media.resourceType === null && media.ownerId === actorId) ||
              (media.resourceType === MediaResourceType.CUISINE &&
                (media.resourceId === cuisineItemId ||
                  media.resourceId === null))),
        )
        .map((media) => media.id),
    );
    if (validIds.size !== ids.length) {
      throw new AppException(
        ErrorCode.INVALID_CUISINE_ITEM_MEDIA,
        'Một hoặc nhiều ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMediaSet(
    tx: Prisma.TransactionClient,
    mediaIds: Array<string | null | undefined>,
    actorId: string,
    cuisineItemId: string,
  ): Promise<void> {
    const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    await tx.media.updateMany({
      where: {
        id: { in: ids },
        ownerId: actorId,
        resourceType: null,
        deletedAt: null,
      },
      data: {
        resourceType: MediaResourceType.CUISINE,
        resourceId: cuisineItemId,
      },
    });
    const usableCount = await tx.media.count({
      where: {
        id: { in: ids },
        resourceType: MediaResourceType.CUISINE,
        OR: [{ resourceId: cuisineItemId }, { resourceId: null }],
        deletedAt: null,
      },
    });
    if (usableCount !== ids.length) {
      throw new AppException(
        ErrorCode.INVALID_CUISINE_ITEM_MEDIA,
        'Một hoặc nhiều ảnh đã được nội dung khác sử dụng',
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
    const locations = await this.mapLocations.getForRecords(
      MapLocationSource.CUISINE,
      [id],
      tx,
    );
    return new AppException(
      ErrorCode.CUISINE_ITEM_VERSION_CONFLICT,
      'Món ăn đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest, locations) }],
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
