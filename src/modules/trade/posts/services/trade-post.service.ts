import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
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
import { TradePostCategoryService } from '../../categories/services/trade-post-category.service';
import type { TradePostSortOption } from '../../trade.constants';
import { CreateTradePostDto } from '../dto/create-trade-post.dto';
import { QueryTradePostDto } from '../dto/query-trade-post.dto';
import { UpdateTradePostDto } from '../dto/update-trade-post.dto';
import { TradePostEntity } from '../entities/trade-post.entity';
import { TradePostRepository } from '../repositories/trade-post.repository';
import { assertValidTradePostState } from '../utils/trade-post-business-rules.util';

@Injectable()
export class TradePostService {
  constructor(
    private readonly tradePostRepository: TradePostRepository,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly categoryService: TradePostCategoryService,
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
    assertValidTradePostState({
      categoryCode: category.code,
      requiresPromotionDetails: category.requiresPromotionDetails,
      priceType: dto.priceType,
      price: dto.price,
      promotionPercent: dto.promotionPercent,
      promotionStartAt: dto.promotionStartAt,
      promotionEndAt: dto.promotionEndAt,
    });

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
          priceType: dto.priceType,
          price: dto.price ?? null,
          priceLabel: dto.priceLabel,
          address: dto.address,
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

    assertValidTradePostState({
      categoryCode: finalCategory.code,
      requiresPromotionDetails: finalCategory.requiresPromotionDetails,
      priceType: dto.priceType ?? existing.priceType,
      price: dto.price !== undefined ? dto.price : existing.price,
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

    const existingPriceNumber = existing.price ? Number(existing.price) : null;
    const substantiveFieldsChanged =
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
          ...(dto.priceType !== undefined ? { priceType: dto.priceType } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.priceLabel !== undefined
            ? { priceLabel: dto.priceLabel }
            : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
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
            ? { expiresAt: new Date(dto.expiresAt) }
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

    return this.getDetailEntityOrThrow(updated.id);
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

  async getPublicDetail(idOrSlug: string): Promise<TradePostEntity> {
    const post = await this.tradePostRepository.findDetailBySlugOrId(idOrSlug);
    if (
      !post ||
      post.status !== TradePostStatus.PUBLISHED ||
      !post.category.isActive ||
      post.category.deletedAt !== null ||
      (post.expiresAt && post.expiresAt.getTime() <= Date.now())
    ) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.tradePostRepository.incrementViewCount(post.id);
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
    conditions.push({
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    });

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

    return this.list(query, { AND: conditions });
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
      orderBy: this.buildOrderBy(query.sortBy ?? 'newest'),
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
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.tradePostRepository.findList({
      skip,
      take,
      where,
      orderBy: this.buildOrderBy(query.sortBy ?? 'newest'),
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

  private buildOrderBy(
    sortBy: TradePostSortOption,
  ): Prisma.TradePostOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'rating':
        return [{ averageRating: 'desc' }, { reviewCount: 'desc' }];
      case 'popular':
        return [{ viewCount: 'desc' }];
      case 'newest':
      default:
        return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
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
