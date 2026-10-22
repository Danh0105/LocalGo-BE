import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  TradePostStatus,
  TradeReviewStatus,
} from '../../../../../generated/prisma';
import { assertCanManage } from '../../../../common/authorization/resource-ownership.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { PaginatedResultDto } from '../../../../common/dto/pagination-meta.dto';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';
import { PrismaService } from '../../../../database/prisma.service';
import { MediaService } from '../../../media/services/media.service';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  NotificationType,
  excerpt,
} from '../../../notifications/notification-types';
import { NotificationService } from '../../../notifications/services/notification.service';
import { TradePostRepository } from '../../posts/repositories/trade-post.repository';
import { MAX_TRADE_REVIEW_IMAGES } from '../../trade.constants';
import { CreateTradeReviewDto } from '../dto/create-trade-review.dto';
import { QueryTradeReviewAdminDto } from '../dto/query-trade-review-admin.dto';
import { TradeReviewAdminStatsResponseDto } from '../dto/trade-review-admin-response.dto';
import { TradeReviewSummaryResponseDto } from '../dto/trade-review-summary-response.dto';
import { UpdateTradeReviewDto } from '../dto/update-trade-review.dto';
import {
  TradeReviewEntity,
  type TradeReviewCustomerReplyView,
} from '../entities/trade-review.entity';
import { TradeReviewRepository } from '../repositories/trade-review.repository';
import { TradeRatingService } from './trade-rating.service';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';

@Injectable()
export class TradeReviewService {
  constructor(
    private readonly tradeReviewRepository: TradeReviewRepository,
    private readonly tradePostRepository: TradePostRepository,
    private readonly tradeRatingService: TradeRatingService,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly notifications: NotificationService,
  ) {}

  async create(
    user: AuthenticatedUser,
    tradePostId: string,
    dto: CreateTradeReviewDto,
  ): Promise<TradeReviewEntity> {
    const tradePost =
      await this.tradePostRepository.findByIdForOwner(tradePostId);
    if (!tradePost || tradePost.status !== TradePostStatus.PUBLISHED) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng hoặc tin chưa được xuất bản',
        HttpStatus.NOT_FOUND,
      );
    }

    if (tradePost.ownerId === user.id) {
      throw new AppException(
        ErrorCode.TRADE_POST_OWNER_CANNOT_REVIEW,
        'Bạn không thể tự đánh giá tin đăng của chính mình',
        HttpStatus.FORBIDDEN,
      );
    }

    const existingActive =
      await this.tradeReviewRepository.findActiveReviewByUserAndPost(
        tradePostId,
        user.id,
      );
    if (existingActive) {
      throw new AppException(
        ErrorCode.REVIEW_ALREADY_EXISTS,
        'Bạn đã đánh giá tin đăng này rồi',
        HttpStatus.CONFLICT,
      );
    }

    const mediaIds = dto.imageIds ?? [];

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const ownedMedia =
          mediaIds.length > 0
            ? await tx.media.findMany({
                where: {
                  id: { in: mediaIds },
                  ownerId: user.id,
                  deletedAt: null,
                },
                select: { id: true },
              })
            : [];
        if (ownedMedia.length !== mediaIds.length) {
          throw new AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Một hoặc nhiều ảnh không hợp lệ hoặc không thuộc về bạn',
            HttpStatus.BAD_REQUEST,
          );
        }

        const created = await tx.tradeReview.create({
          data: {
            tradePostId,
            userId: user.id,
            rating: dto.rating,
            content: dto.content,
            // Reviews are post-moderated: public at once, admins may hide later.
            status: TradeReviewStatus.PUBLISHED,
          },
        });

        if (mediaIds.length > 0) {
          await tx.tradeReviewImage.createMany({
            data: mediaIds.map((mediaId, index) => ({
              tradeReviewId: created.id,
              mediaId,
              sortOrder: index,
            })),
          });
        }

        await this.tradeRatingService.recompute(tx, tradePostId);

        return created;
      });

      const entity = await this.getDetailEntityOrThrow(review.id);
      await this.notifications.notify(tradePost.ownerId, {
        type: NotificationType.TRADE_REVIEW_RECEIVED,
        title: 'Đánh giá mới',
        body: `${entity.reviewer?.displayName ?? 'Khách hàng'} đánh giá ${entity.rating}★ tin "${excerpt(tradePost.title, 80)}": ${excerpt(entity.content, 100)}`,
        data: this.reviewNotificationData(entity),
      });
      await this.notifications.notifyStaff(
        {
          type: NotificationType.TRADE_REVIEW_SUBMITTED,
          title: 'Đánh giá giao thương mới',
          body: `${entity.reviewer?.displayName ?? user.displayName} vừa đánh giá ${entity.rating}★ tin "${excerpt(tradePost.title, 80)}": ${excerpt(entity.content, 100)}`,
          data: {
            ...this.reviewNotificationData(entity),
            submittedById: user.id,
          },
        },
        [tradePost.ownerId, user.id],
      );
      return entity;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          ErrorCode.REVIEW_ALREADY_EXISTS,
          'Bạn đã đánh giá tin đăng này rồi',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateTradeReviewDto,
  ): Promise<TradeReviewEntity> {
    const existing = await this.getActiveOrThrow(id);
    assertCanManage(user, { ownerId: existing.userId }, []);

    const mediaIds = dto.imageIds;

    let removedMediaIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      if (mediaIds !== undefined) {
        const ownedMedia =
          mediaIds.length > 0
            ? await tx.media.findMany({
                where: {
                  id: { in: mediaIds },
                  ownerId: user.id,
                  deletedAt: null,
                },
                select: { id: true },
              })
            : [];
        if (ownedMedia.length !== mediaIds.length) {
          throw new AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Một hoặc nhiều ảnh không hợp lệ hoặc không thuộc về bạn',
            HttpStatus.BAD_REQUEST,
          );
        }
        const previousImages = await tx.tradeReviewImage.findMany({
          where: { tradeReviewId: id },
          select: { mediaId: true },
        });
        removedMediaIds = previousImages
          .map((image) => image.mediaId)
          .filter((mediaId) => !mediaIds.includes(mediaId));
        await tx.tradeReviewImage.deleteMany({ where: { tradeReviewId: id } });
        if (mediaIds.length > 0) {
          await tx.tradeReviewImage.createMany({
            data: mediaIds.map((mediaId, index) => ({
              tradeReviewId: id,
              mediaId,
              sortOrder: index,
            })),
          });
        }
      }

      // Edits keep the current status: no re-moderation, and a review an
      // admin hid stays hidden.
      await tx.tradeReview.update({
        where: { id },
        data: {
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
        },
      });

      // A new rating on a counted review shifts the post's aggregate.
      if (
        dto.rating !== undefined &&
        existing.status === TradeReviewStatus.PUBLISHED
      ) {
        await this.tradeRatingService.recompute(tx, existing.tradePostId);
      }
    });

    if (removedMediaIds.length > 0) {
      const deletedMediaIds =
        await this.mediaService.pruneDetachedMedia(removedMediaIds);
      await this.mediaService.purgeStorage(deletedMediaIds);
    }

    return this.getDetailEntityOrThrow(id);
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async moderate(
    actorId: string,
    id: string,
    status: 'PUBLISHED' | 'HIDDEN',
  ): Promise<TradeReviewEntity> {
    const existing = await this.getActiveOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.tradeReview.update({ where: { id }, data: { status } });
      await this.tradeRatingService.recompute(tx, existing.tradePostId);
    });

    await this.auditLogService.write({
      actorId,
      action: `TRADE_REVIEW_${status}`,
      resourceType: 'TradeReview',
      resourceId: id,
      oldData: { status: existing.status },
      newData: { status },
    });

    const postTitle = excerpt(
      existing.tradePost?.title ?? 'tin giao thương',
      80,
    );
    if (
      status === TradeReviewStatus.PUBLISHED &&
      existing.status !== TradeReviewStatus.PUBLISHED
    ) {
      // The post owner already heard about the review when it was created.
      await this.notifyReviewer(
        existing,
        NotificationType.TRADE_REVIEW_APPROVED,
        'Đánh giá đã hiển thị lại',
        `Đánh giá của bạn về "${postTitle}" đã được hiển thị công khai trở lại.`,
      );
    } else if (
      status === TradeReviewStatus.HIDDEN &&
      existing.status !== TradeReviewStatus.HIDDEN
    ) {
      await this.notifyReviewer(
        existing,
        NotificationType.TRADE_REVIEW_HIDDEN,
        'Đánh giá bị ẩn',
        `Đánh giá của bạn về "${postTitle}" đã bị quản trị viên ẩn.`,
      );
    }

    return this.getAdminDetailOrThrow(id);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.getActiveOrThrow(id);
    assertCanManage(user, { ownerId: existing.userId });
    await this.softDeleteAndRecompute(existing);
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async removeByAdmin(actorId: string, id: string): Promise<void> {
    const existing = await this.getActiveOrThrow(id);
    const deletedAt = await this.softDeleteAndRecompute(existing);

    await this.auditLogService.write({
      actorId,
      action: 'TRADE_REVIEW_DELETE',
      resourceType: 'TradeReview',
      resourceId: id,
      oldData: {
        status: existing.status,
        rating: existing.rating,
        content: existing.content,
        deletedAt: null,
      },
      newData: { deletedAt: deletedAt.toISOString() },
    });
    await this.notifyReviewer(
      existing,
      NotificationType.TRADE_REVIEW_DELETED,
      'Đánh giá bị xóa',
      `Đánh giá của bạn về "${excerpt(existing.tradePost?.title ?? 'tin giao thương', 80)}" đã bị quản trị viên xóa.`,
    );
  }

  async attachImage(
    user: AuthenticatedUser,
    reviewId: string,
    mediaId: string,
  ): Promise<TradeReviewEntity> {
    const existing = await this.getActiveOrThrow(reviewId);
    assertCanManage(user, { ownerId: existing.userId }, []);

    if (existing.images.length >= MAX_TRADE_REVIEW_IMAGES) {
      throw new AppException(
        ErrorCode.UPLOAD_LIMIT_EXCEEDED,
        `Tối đa ${MAX_TRADE_REVIEW_IMAGES} ảnh cho mỗi đánh giá`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, ownerId: user.id, deletedAt: null },
    });
    if (!media) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy ảnh hoặc ảnh không thuộc về bạn',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.tradeReviewImage.create({
      data: {
        tradeReviewId: reviewId,
        mediaId,
        sortOrder: existing.images.length,
      },
    });

    return this.getDetailEntityOrThrow(reviewId);
  }

  async removeImage(
    user: AuthenticatedUser,
    reviewId: string,
    imageId: string,
  ): Promise<TradeReviewEntity> {
    const existing = await this.getActiveOrThrow(reviewId);
    assertCanManage(user, { ownerId: existing.userId }, []);

    await this.prisma.tradeReviewImage.deleteMany({
      where: { tradeReviewId: reviewId, mediaId: imageId },
    });
    const deletedMediaIds = await this.mediaService.pruneDetachedMedia([
      imageId,
    ]);
    await this.mediaService.purgeStorage(deletedMediaIds);

    return this.getDetailEntityOrThrow(reviewId);
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async listForAdmin(
    query: QueryTradeReviewAdminDto,
  ): Promise<PaginatedResultDto<TradeReviewEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.tradeReviewRepository.findAdminList({
      skip,
      take,
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.tradePostId ? { tradePostId: query.tradePostId } : {}),
        ...(query.rating ? { rating: query.rating } : {}),
        ...(query.search
          ? {
              OR: [
                { content: { contains: query.search, mode: 'insensitive' } },
                {
                  user: {
                    displayName: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  tradePost: {
                    title: { contains: query.search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      sortOrder: query.sortOrder,
    });
    return paginate(
      items.map((item) => new TradeReviewEntity(item)),
      query.page,
      query.limit,
      total,
    );
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async getAdminDetail(id: string): Promise<TradeReviewEntity> {
    return this.getAdminDetailOrThrow(id);
  }

  /** Moderator/admin only — counts per status for the moderation queue tabs. */
  async getAdminStats(
    tradePostId?: string,
  ): Promise<TradeReviewAdminStatsResponseDto> {
    const rows = await this.tradeReviewRepository.countByStatus(
      tradePostId ? { tradePostId } : {},
    );
    const byStatus: TradeReviewAdminStatsResponseDto['byStatus'] = {
      PENDING: 0,
      PUBLISHED: 0,
      HIDDEN: 0,
    };
    for (const row of rows) {
      byStatus[row.status] = row.count;
    }

    const dto = new TradeReviewAdminStatsResponseDto();
    dto.byStatus = byStatus;
    dto.total = byStatus.PENDING + byStatus.PUBLISHED + byStatus.HIDDEN;
    return dto;
  }

  async listPublicForPost(
    tradePostId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<TradeReviewEntity>> {
    const { skip, take } = buildPaginationArgs(page, limit);
    const { items, total } = await this.tradeReviewRepository.findPublicList({
      tradePostId,
      skip,
      take,
    });
    return paginate(
      items.map((item) => new TradeReviewEntity(item)),
      page,
      limit,
      total,
    );
  }

  async getSummary(
    tradePostId: string,
  ): Promise<TradeReviewSummaryResponseDto> {
    const grouped = await this.prisma.tradeReview.groupBy({
      by: ['rating'],
      where: {
        tradePostId,
        status: TradeReviewStatus.PUBLISHED,
        deletedAt: null,
      },
      _count: { rating: true },
    });

    const counts: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    let total = 0;
    let sum = 0;
    for (const row of grouped) {
      const key = String(row.rating) as '1' | '2' | '3' | '4' | '5';
      counts[key] = row._count.rating;
      total += row._count.rating;
      sum += row.rating * row._count.rating;
    }

    const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    if (total > 0) {
      for (const key of ['1', '2', '3', '4', '5'] as const) {
        distribution[key] = Math.round((counts[key] / total) * 100);
      }
    }

    const dto = new TradeReviewSummaryResponseDto();
    dto.average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
    dto.total = total;
    dto.distribution = distribution;
    dto.counts = counts;
    return dto;
  }

  /** Seller center: published reviews on the caller's own posts. */
  async listForPostOwner(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<TradeReviewEntity>> {
    const { skip, take } = buildPaginationArgs(page, limit);
    const { items, total } = await this.tradeReviewRepository.findForPostOwner({
      ownerId,
      skip,
      take,
    });
    return paginate(
      items.map((item) => new TradeReviewEntity(item)),
      page,
      limit,
      total,
    );
  }

  /** Creates a public customer message below an existing seller reply. */
  async createCustomerReply(
    user: AuthenticatedUser,
    tradePostId: string,
    reviewId: string,
    content: string,
  ): Promise<TradeReviewCustomerReplyView> {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.tradeReviewRepository.lockCustomerReplyTarget(
        tx,
        tradePostId,
        reviewId,
      );
      const expiry = target?.expiresAt ?? target?.eventEndAt ?? null;
      const isPublic =
        target !== null &&
        target.reviewDeletedAt === null &&
        target.reviewStatus === TradeReviewStatus.PUBLISHED &&
        target.postDeletedAt === null &&
        target.postStatus === TradePostStatus.PUBLISHED &&
        target.categoryActive &&
        target.categoryDeletedAt === null &&
        (expiry === null || expiry.getTime() > Date.now());

      if (!target || !isPublic) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy tin đăng hoặc đánh giá công khai',
          HttpStatus.NOT_FOUND,
        );
      }

      if (target.ownerId === user.id) {
        throw new AppException(
          ErrorCode.TRADE_REVIEW_CUSTOMER_REPLY_NOT_ALLOWED,
          'Chủ tin không thể dùng luồng trả lời dành cho khách hàng',
          HttpStatus.FORBIDDEN,
        );
      }

      if (target.replyContent === null) {
        throw new AppException(
          ErrorCode.TRADE_REVIEW_OWNER_REPLY_REQUIRED,
          'Phản hồi của chủ tin không còn tồn tại',
          HttpStatus.CONFLICT,
        );
      }

      const reply = await this.tradeReviewRepository.createCustomerReply(tx, {
        reviewId,
        userId: user.id,
        content: content.trim(),
      });
      return {
        id: reply.id,
        reviewId: reply.reviewId,
        userId: reply.userId,
        content: reply.content,
        createdAt: reply.createdAt,
        author: reply.author
          ? {
              id: reply.author.id,
              displayName: reply.author.displayName,
              avatarUrl: reply.author.avatarUrl,
            }
          : null,
      };
    });
  }

  /** Sets (or replaces) the post owner's public reply; the review itself is untouched. */
  async reply(
    user: AuthenticatedUser,
    id: string,
    content: string,
  ): Promise<TradeReviewEntity> {
    await this.assertCanReply(user, id);
    await this.prisma.tradeReview.update({
      where: { id },
      data: { replyContent: content.trim(), repliedAt: new Date() },
    });
    const review = await this.getDetailEntityOrThrow(id);
    await this.notifyReviewer(
      review,
      NotificationType.TRADE_REVIEW_REPLIED,
      'Người bán đã phản hồi đánh giá',
      `Phản hồi về "${excerpt(review.tradePost?.title ?? 'tin giao thương', 80)}": ${excerpt(content, 150)}`,
    );
    return review;
  }

  private notifyReviewer(
    review: TradeReviewEntity,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<void> {
    return this.notifications.notify(review.userId, {
      type,
      title,
      body,
      data: this.reviewNotificationData(review),
    });
  }

  private reviewNotificationData(review: TradeReviewEntity) {
    return {
      tradePostId: review.tradePostId,
      slug: review.tradePost?.slug,
      reviewId: review.id,
    };
  }

  async removeReply(
    user: AuthenticatedUser,
    id: string,
  ): Promise<TradeReviewEntity> {
    await this.assertCanReply(user, id);
    await this.prisma.tradeReview.update({
      where: { id },
      data: { replyContent: null, repliedAt: null },
    });
    return this.getDetailEntityOrThrow(id);
  }

  /** Only the owner of the reviewed post may reply, and only to a visible review. */
  private async assertCanReply(
    user: AuthenticatedUser,
    id: string,
  ): Promise<void> {
    const review = await this.prisma.tradeReview.findFirst({
      where: {
        id,
        deletedAt: null,
        status: TradeReviewStatus.PUBLISHED,
        tradePost: { deletedAt: null },
      },
      select: { tradePost: { select: { ownerId: true } } },
    });
    if (!review) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy đánh giá',
        HttpStatus.NOT_FOUND,
      );
    }
    if (review.tradePost.ownerId !== user.id) {
      throw new AppException(
        ErrorCode.REVIEW_REPLY_NOT_ALLOWED,
        'Chỉ người đăng tin mới được phản hồi đánh giá này',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async getActiveOrThrow(id: string): Promise<TradeReviewEntity> {
    const review = await this.tradeReviewRepository.findDetailById(id);
    if (!review) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy đánh giá',
        HttpStatus.NOT_FOUND,
      );
    }
    return new TradeReviewEntity(review);
  }

  private async getDetailEntityOrThrow(id: string): Promise<TradeReviewEntity> {
    return this.getActiveOrThrow(id);
  }

  private async getAdminDetailOrThrow(id: string): Promise<TradeReviewEntity> {
    const review = await this.tradeReviewRepository.findAdminDetailById(id);
    if (!review) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy đánh giá',
        HttpStatus.NOT_FOUND,
      );
    }
    return new TradeReviewEntity(review);
  }

  /**
   * Soft-deletes a review and recomputes the post's rating in the same
   * transaction (a PUBLISHED review leaving the set changes the aggregate).
   */
  private async softDeleteAndRecompute(
    review: TradeReviewEntity,
  ): Promise<Date> {
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.tradeReview.update({
        where: { id: review.id },
        data: { deletedAt },
      });
      await this.tradeRatingService.recompute(tx, review.tradePostId);
    });
    return deletedAt;
  }
}
