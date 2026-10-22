import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BusinessType,
  Prisma,
  TradePostPurpose,
  TradePostStatus,
  UserRole,
} from '../../../../../generated/prisma';
import { assertCanManage } from '../../../../common/authorization/resource-ownership.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { PaginatedResultDto } from '../../../../common/dto/pagination-meta.dto';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';
import { slugify } from '../../../../common/utils/slugify.util';
import { PrismaService } from '../../../../database/prisma.service';
import { MediaService } from '../../../media/services/media.service';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  NotificationType,
  excerpt,
} from '../../../notifications/notification-types';
import { NotificationService } from '../../../notifications/services/notification.service';
import {
  BUSINESS_TYPE_CONFIG,
  allowedPostPurposes,
} from '../../../business-applications/business-type.config';
import { TradePostCategoryService } from '../../categories/services/trade-post-category.service';
import {
  TRADE_POST_SECTION_BUSINESS_TYPES,
  TRADE_POST_SECTION_PURPOSES,
  type TradePostSortOption,
} from '../../trade.constants';
import { CreateTradePostDto } from '../dto/create-trade-post.dto';
import { QueryTradePostDto } from '../dto/query-trade-post.dto';
import { UpdateTradePostDto } from '../dto/update-trade-post.dto';
import { TradePostEntity } from '../entities/trade-post.entity';
import { TradePostRepository } from '../repositories/trade-post.repository';
import {
  assertEventEndInFuture,
  assertExpiresAtInFuture,
  assertValidTradePostState,
  isPubliclyVisible,
  notExpiredWhere,
} from '../utils/trade-post-business-rules.util';
import { TradePostEngagementService } from './trade-post-engagement.service';

@Injectable()
export class TradePostService {
  constructor(
    private readonly tradePostRepository: TradePostRepository,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly categoryService: TradePostCategoryService,
    private readonly engagementService: TradePostEngagementService,
    private readonly notifications: NotificationService,
  ) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateTradePostDto,
  ): Promise<TradePostEntity> {
    if (currentUser.role !== UserRole.BUSINESS) {
      throw new AppException(
        ErrorCode.BUSINESS_PROFILE_REQUIRED,
        'Bạn cần có hồ sơ Business đã được duyệt để đăng tin. Vui lòng nộp hồ sơ đăng ký.',
        HttpStatus.FORBIDDEN,
      );
    }
    const category = await this.categoryService.findActiveByCodeOrThrow(
      dto.category,
    );
    const purpose = await this.resolvePurpose(currentUser.id, dto.purpose);
    const isNonProfit = purpose === TradePostPurpose.NON_PROFIT;
    // Price only applies to commercial posts, event dates only to non-profit ones.
    const pricing = isNonProfit
      ? { priceType: null, price: null, priceLabel: null }
      : {
          priceType: dto.priceType ?? null,
          price: dto.price ?? null,
          priceLabel: dto.priceLabel ?? null,
        };
    const eventStartAt = isNonProfit ? (dto.eventStartAt ?? null) : null;
    const eventEndAt = isNonProfit ? (dto.eventEndAt ?? null) : null;
    assertValidTradePostState({
      categoryCode: category.code,
      requiresPromotionDetails: category.requiresPromotionDetails,
      purpose,
      ...pricing,
      promotionPercent: dto.promotionPercent,
      promotionStartAt: dto.promotionStartAt,
      promotionEndAt: dto.promotionEndAt,
      eventStartAt,
      eventEndAt,
    });
    assertExpiresAtInFuture(dto.expiresAt);
    assertEventEndInFuture(eventEndAt);

    const ownerId = currentUser.id;
    const slug = await this.generateUniqueSlug(dto.title);
    const mediaIds = dto.imageIds ?? [];

    const created = await this.prisma.$transaction(async (tx) => {
      const ownedMedia =
        mediaIds.length > 0
          ? await tx.media.findMany({
              where: { id: { in: mediaIds }, ownerId, deletedAt: null },
              select: { id: true, originalUrl: true },
            })
          : [];
      if (ownedMedia.length !== mediaIds.length) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Một hoặc nhiều ảnh không hợp lệ hoặc không thuộc về bạn',
          HttpStatus.BAD_REQUEST,
        );
      }

      const post = await tx.tradePost.create({
        data: {
          slug,
          ownerId,
          categoryId: category.id,
          title: dto.title,
          summary: dto.summary,
          description: dto.description,
          purpose,
          ...pricing,
          eventStartAt: eventStartAt ? new Date(eventStartAt) : null,
          eventEndAt: eventEndAt ? new Date(eventEndAt) : null,
          address: dto.address,
          googleMapsUrl: dto.googleMapsUrl || null,
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactZalo: dto.contactZalo,
          thumbnailUrl: ownedMedia[0]?.originalUrl,
          promotionPercent: dto.promotionPercent,
          promotionStartAt: dto.promotionStartAt
            ? new Date(dto.promotionStartAt)
            : null,
          promotionEndAt: dto.promotionEndAt
            ? new Date(dto.promotionEndAt)
            : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });

      if (mediaIds.length > 0) {
        await tx.tradePostImage.createMany({
          data: mediaIds.map((mediaId, index) => ({
            tradePostId: post.id,
            mediaId,
            sortOrder: index,
          })),
        });
      }

      return post;
    });

    return this.getDetailEntityOrThrow(created.id);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateTradePostDto,
  ): Promise<TradePostEntity> {
    const existing = await this.tradePostRepository.findByIdForOwner(id);
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    assertCanManage(currentUser, existing);

    if (
      existing.status === TradePostStatus.PENDING ||
      existing.status === TradePostStatus.ARCHIVED
    ) {
      throw new AppException(
        ErrorCode.TRADE_POST_NOT_EDITABLE,
        'Tin đang chờ duyệt hoặc đã lưu trữ không thể chỉnh sửa',
        HttpStatus.CONFLICT,
      );
    }

    const finalCategory =
      dto.category !== undefined
        ? await this.categoryService.findActiveByCodeOrThrow(dto.category)
        : existing.category;

    // Validate even when purpose was not changed, so invalid legacy/imported
    // commercial posts owned by a temple board cannot be edited and re-used.
    const purpose = await this.resolvePurpose(
      existing.ownerId,
      dto.purpose ?? existing.purpose,
    );
    const isNonProfit = purpose === TradePostPurpose.NON_PROFIT;
    // Switching purpose clears what no longer applies: price for non-profit
    // posts, event dates for commercial ones.
    const pricingPatch = isNonProfit
      ? { priceType: null, price: null, priceLabel: null }
      : {
          ...(dto.priceType !== undefined ? { priceType: dto.priceType } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.priceLabel !== undefined
            ? { priceLabel: dto.priceLabel }
            : {}),
        };
    const eventPatch = isNonProfit
      ? {
          ...(dto.eventStartAt !== undefined
            ? {
                eventStartAt: dto.eventStartAt
                  ? new Date(dto.eventStartAt)
                  : null,
              }
            : {}),
          ...(dto.eventEndAt !== undefined
            ? { eventEndAt: dto.eventEndAt ? new Date(dto.eventEndAt) : null }
            : {}),
        }
      : { eventStartAt: null, eventEndAt: null };

    assertValidTradePostState({
      categoryCode: finalCategory.code,
      requiresPromotionDetails: finalCategory.requiresPromotionDetails,
      purpose,
      priceType: isNonProfit
        ? null
        : dto.priceType !== undefined
          ? dto.priceType
          : existing.priceType,
      price: isNonProfit
        ? null
        : dto.price !== undefined
          ? dto.price
          : existing.price,
      eventStartAt:
        eventPatch.eventStartAt !== undefined
          ? eventPatch.eventStartAt
          : existing.eventStartAt,
      eventEndAt:
        eventPatch.eventEndAt !== undefined
          ? eventPatch.eventEndAt
          : existing.eventEndAt,
      promotionPercent:
        dto.promotionPercent !== undefined
          ? dto.promotionPercent
          : existing.promotionPercent,
      promotionStartAt:
        dto.promotionStartAt !== undefined
          ? dto.promotionStartAt
          : existing.promotionStartAt,
      promotionEndAt:
        dto.promotionEndAt !== undefined
          ? dto.promotionEndAt
          : existing.promotionEndAt,
    });
    assertExpiresAtInFuture(dto.expiresAt);
    if (isNonProfit) {
      assertEventEndInFuture(dto.eventEndAt);
    }

    const existingPriceNumber = existing.price ? Number(existing.price) : null;
    const substantiveFieldsChanged =
      purpose !== existing.purpose ||
      (dto.title !== undefined && dto.title !== existing.title) ||
      (dto.description !== undefined &&
        dto.description !== existing.description) ||
      (dto.category !== undefined &&
        finalCategory.code !== existing.category.code) ||
      (dto.priceType !== undefined && dto.priceType !== existing.priceType) ||
      (dto.price !== undefined && dto.price !== existingPriceNumber);

    const shouldRevertToPending =
      existing.status === TradePostStatus.PUBLISHED && substantiveFieldsChanged;

    const mediaIds = dto.imageIds;

    let removedMediaIds: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      let thumbnailUrl: string | null | undefined;

      if (mediaIds !== undefined) {
        const ownedMedia =
          mediaIds.length > 0
            ? await tx.media.findMany({
                where: {
                  id: { in: mediaIds },
                  ownerId: existing.ownerId,
                  deletedAt: null,
                },
                select: { id: true, originalUrl: true },
              })
            : [];
        if (ownedMedia.length !== mediaIds.length) {
          throw new AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Một hoặc nhiều ảnh không hợp lệ hoặc không thuộc về bạn',
            HttpStatus.BAD_REQUEST,
          );
        }
        const previousImages = await tx.tradePostImage.findMany({
          where: { tradePostId: id },
          select: { mediaId: true },
        });
        removedMediaIds = previousImages
          .map((image) => image.mediaId)
          .filter((mediaId) => !mediaIds.includes(mediaId));
        await tx.tradePostImage.deleteMany({ where: { tradePostId: id } });
        if (mediaIds.length > 0) {
          await tx.tradePostImage.createMany({
            data: mediaIds.map((mediaId, index) => ({
              tradePostId: id,
              mediaId,
              sortOrder: index,
            })),
          });
        }
        thumbnailUrl = ownedMedia[0]?.originalUrl ?? null;
      }

      return tx.tradePost.update({
        where: { id },
        data: {
          ...(dto.category !== undefined
            ? { categoryId: finalCategory.id }
            : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          purpose,
          ...pricingPatch,
          ...eventPatch,
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.googleMapsUrl !== undefined
            ? { googleMapsUrl: dto.googleMapsUrl || null }
            : {}),
          ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
          ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
          ...(dto.contactName !== undefined
            ? { contactName: dto.contactName }
            : {}),
          ...(dto.contactPhone !== undefined
            ? { contactPhone: dto.contactPhone }
            : {}),
          ...(dto.contactZalo !== undefined
            ? { contactZalo: dto.contactZalo }
            : {}),
          ...(dto.promotionPercent !== undefined
            ? { promotionPercent: dto.promotionPercent }
            : {}),
          ...(dto.promotionStartAt !== undefined
            ? {
                promotionStartAt: dto.promotionStartAt
                  ? new Date(dto.promotionStartAt)
                  : null,
              }
            : {}),
          ...(dto.promotionEndAt !== undefined
            ? {
                promotionEndAt: dto.promotionEndAt
                  ? new Date(dto.promotionEndAt)
                  : null,
              }
            : {}),
          ...(dto.expiresAt !== undefined
            ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
            : {}),
          ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
          ...(shouldRevertToPending ? { status: TradePostStatus.PENDING } : {}),
        },
      });
    });

    if (removedMediaIds.length > 0) {
      const deletedMediaIds =
        await this.mediaService.pruneDetachedMedia(removedMediaIds);
      await this.mediaService.purgeStorage(deletedMediaIds);
    }

    if (shouldRevertToPending) {
      await this.notifications.notifyStaff({
        type: NotificationType.TRADE_POST_SUBMITTED,
        title: 'Tin giao thương được cập nhật',
        body: `${currentUser.displayName} vừa cập nhật tin "${excerpt(updated.title, 90)}"; tin đang chờ duyệt lại.`,
        data: {
          tradePostId: updated.id,
          slug: updated.slug,
          submittedById: currentUser.id,
        },
      });
    }

    return this.getDetailEntityOrThrow(updated.id);
  }

  /**
   * Purpose for a post owned by `ownerId`: the requested one if the owner's
   * business type allows it, otherwise the type's default (temple management
   * boards only publish non-profit posts).
   */
  private async resolvePurpose(
    ownerId: string,
    requested: TradePostPurpose | undefined,
  ): Promise<TradePostPurpose> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { businessType: true },
    });
    const allowed = allowedPostPurposes(owner?.businessType);
    if (requested === undefined) {
      return allowed.includes(TradePostPurpose.COMMERCIAL)
        ? TradePostPurpose.COMMERCIAL
        : allowed[0];
    }
    if (!allowed.includes(requested)) {
      throw new AppException(
        ErrorCode.TRADE_POST_PURPOSE_NOT_ALLOWED,
        `Tài khoản ${BUSINESS_TYPE_CONFIG[owner?.businessType ?? BusinessType.GENERAL].label} chỉ được đăng tin ${allowed
          .map((value) =>
            value === TradePostPurpose.NON_PROFIT
              ? 'phi lợi nhuận'
              : 'có lợi nhuận',
          )
          .join(' hoặc ')}`,
        HttpStatus.FORBIDDEN,
      );
    }
    return requested;
  }

  async remove(currentUser: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.tradePostRepository.findByIdForOwner(id);
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    assertCanManage(currentUser, existing);
    await this.tradePostRepository.softDelete(id);
  }

  /** `viewerId` (optional) attributes the recorded view to a signed-in user. */
  async getPublicDetail(
    idOrSlug: string,
    viewerId?: string,
  ): Promise<TradePostEntity> {
    const post = await this.tradePostRepository.findDetailBySlugOrId(idOrSlug);
    if (!post || !isPubliclyVisible(post)) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.tradePostRepository.incrementViewCount(post.id);
    await this.engagementService.recordView(post.id, viewerId);
    return new TradePostEntity(post);
  }

  async getOwnerOrAdminDetail(
    currentUser: AuthenticatedUser,
    idOrSlug: string,
  ): Promise<TradePostEntity> {
    const post = await this.tradePostRepository.findAdminDetail(idOrSlug);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    assertCanManage(currentUser, post);
    return new TradePostEntity(post);
  }

  async listPublic(
    query: QueryTradePostDto,
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const conditions = await this.buildCommonFilters(query, true);
    conditions.push({ deletedAt: null });
    conditions.push({ status: TradePostStatus.PUBLISHED });
    conditions.push({ category: { isActive: true, deletedAt: null } });
    conditions.push(notExpiredWhere());

    return this.list(query, { AND: conditions });
  }

  async listMine(
    ownerId: string,
    query: QueryTradePostDto,
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const conditions = await this.buildCommonFilters(query, false);
    conditions.push({ deletedAt: null });
    conditions.push({ ownerId });
    if (query.status) {
      conditions.push({ status: query.status });
    }

    // Own posts include drafts (no publishedAt), so "newest" means newest created.
    return this.list(query, { AND: conditions }, 'createdAt');
  }

  async listForAdmin(
    query: QueryTradePostDto,
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const conditions = await this.buildCommonFilters(query, false);
    conditions.push({ deletedAt: null });
    if (query.status) {
      conditions.push({ status: query.status });
    }

    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.tradePostRepository.findAdminList({
      skip,
      take,
      where: { AND: conditions },
      orderBy: this.buildOrderBy(query.sortBy ?? 'newest', query.sortOrder),
    });
    return paginate(
      items.map((item) => new TradePostEntity(item)),
      query.page,
      query.limit,
      total,
    );
  }

  private async list(
    query: QueryTradePostDto,
    where: Prisma.TradePostWhereInput,
    newestBy: 'publishedAt' | 'createdAt' = 'publishedAt',
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.tradePostRepository.findList({
      skip,
      take,
      where,
      orderBy: this.buildOrderBy(
        query.sortBy ?? 'newest',
        query.sortOrder,
        newestBy,
      ),
    });
    return paginate(
      items.map((item) => new TradePostEntity(item)),
      query.page,
      query.limit,
      total,
    );
  }

  private async buildCommonFilters(
    query: QueryTradePostDto,
    activeCategoryOnly: boolean,
  ): Promise<Prisma.TradePostWhereInput[]> {
    const conditions: Prisma.TradePostWhereInput[] = [];
    if (query.category) {
      const category = await this.categoryService.findVisibleByCodeOrThrow(
        query.category,
        activeCategoryOnly,
      );
      conditions.push({ categoryId: category.id });
    }
    if (query.featured !== undefined) {
      conditions.push({ featured: query.featured });
    }
    if (query.purpose) {
      conditions.push({ purpose: query.purpose });
    }
    if (query.section) {
      const purposes = TRADE_POST_SECTION_PURPOSES[query.section];
      conditions.push({
        owner: {
          businessType: {
            in: TRADE_POST_SECTION_BUSINESS_TYPES[query.section],
          },
        },
      });
      if (purposes) conditions.push({ purpose: { in: purposes } });
    }
    if (query.ownerId) {
      conditions.push({ ownerId: query.ownerId });
    }
    if (query.minPrice !== undefined) {
      conditions.push({ price: { gte: query.minPrice } });
    }
    if (query.maxPrice !== undefined) {
      conditions.push({ price: { lte: query.maxPrice } });
    }
    if (query.search) {
      conditions.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { summary: { contains: query.search, mode: 'insensitive' } },
          { address: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    return conditions;
  }

  /**
   * `sortOrder` (default desc) flips newest/rating/popular; price_asc and
   * price_desc carry their own direction.
   */
  private buildOrderBy(
    sortBy: TradePostSortOption,
    sortOrder: Prisma.SortOrder = 'desc',
    newestBy: 'publishedAt' | 'createdAt' = 'publishedAt',
  ): Prisma.TradePostOrderByWithRelationInput[] {
    switch (sortBy) {
      // Posts without a price (non-profit, negotiable, contact) sort last either way.
      case 'price_asc':
        return [{ price: { sort: 'asc', nulls: 'last' } }];
      case 'price_desc':
        return [{ price: { sort: 'desc', nulls: 'last' } }];
      case 'rating':
        return [{ averageRating: sortOrder }, { reviewCount: sortOrder }];
      case 'popular':
        return [{ viewCount: sortOrder }];
      case 'newest':
      default:
        return newestBy === 'createdAt'
          ? [{ createdAt: sortOrder }]
          : [{ publishedAt: sortOrder }, { createdAt: sortOrder }];
    }
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let counter = 2;
    while (await this.tradePostRepository.slugExists(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  private async getDetailEntityOrThrow(id: string): Promise<TradePostEntity> {
    const post = await this.tradePostRepository.findDetailBySlugOrId(id);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    return new TradePostEntity(post);
  }
}
