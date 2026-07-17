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
import { TradePostRepository } from '../../posts/repositories/trade-post.repository';
import { MAX_TRADE_REVIEW_IMAGES } from '../../trade.constants';
import { CreateTradeReviewDto } from '../dto/create-trade-review.dto';
import { QueryTradeReviewAdminDto } from '../dto/query-trade-review-admin.dto';
import { TradeReviewSummaryResponseDto } from '../dto/trade-review-summary-response.dto';
import { UpdateTradeReviewDto } from '../dto/update-trade-review.dto';
import { TradeReviewEntity } from '../entities/trade-review.entity';
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

        return created;
      });

      return this.getDetailEntityOrThrow(review.id);
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
    const willRevertToPending =
      existing.status === TradeReviewStatus.PUBLISHED &&
      (dto.rating !== undefined || dto.content !== undefined);

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

      await tx.tradeReview.update({
        where: { id },
        data: {
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          // Content edits require re-moderation, mirroring the trade-post rule.
          ...(dto.rating !== undefined || dto.content !== undefined
            ? { status: TradeReviewStatus.PENDING }
            : {}),
        },
      });

      // The edit dropped a previously-counted PUBLISHED review back to
      // PENDING — the post's aggregate must reflect that immediately.
      if (willRevertToPending) {
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

    return this.getDetailEntityOrThrow(id);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.getActiveOrThrow(id);
    assertCanManage(user, { ownerId: existing.userId });

    await this.prisma.$transaction(async (tx) => {
      await tx.tradeReview.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.tradeRatingService.recompute(tx, existing.tradePostId);
    });
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
      },
    });
    return paginate(
      items.map((item) => new TradeReviewEntity(item)),
      query.page,
      query.limit,
      total,
    );
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
}
