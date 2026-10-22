import { HttpStatus, Injectable } from '@nestjs/common';
import { TradePostEventType } from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import type { PaginatedResultDto } from '../../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';
import { PrismaService } from '../../../../database/prisma.service';
import type { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import {
  NotificationType,
  excerpt,
} from '../../../notifications/notification-types';
import { NotificationService } from '../../../notifications/services/notification.service';
import { TradePostEntity } from '../../posts/entities/trade-post.entity';
import { TradePostEventRepository } from '../../posts/repositories/trade-post-event.repository';
import { TradePostRepository } from '../../posts/repositories/trade-post.repository';
import { isPubliclyVisible } from '../../posts/utils/trade-post-business-rules.util';
import { TradePostFavoriteRepository } from '../repositories/trade-post-favorite.repository';

@Injectable()
export class TradePostFavoriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly favoriteRepository: TradePostFavoriteRepository,
    private readonly tradePostRepository: TradePostRepository,
    private readonly eventRepository: TradePostEventRepository,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Saves (bookmarks) a viewable post for the user. Idempotent: re-saving is a
   * no-op that returns the current save count without emitting a duplicate
   * SAVE event. Save count is recomputed from the actual rows to avoid drift.
   */
  async save(
    userId: string,
    idOrSlug: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    const post =
      await this.tradePostRepository.findViewableIdBySlugOrId(idOrSlug);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }

    let newlySaved = false;
    const saveCount = await this.prisma.$transaction(async (tx) => {
      const existing = await this.favoriteRepository.findSaved(
        userId,
        post.id,
        tx,
      );
      if (!existing) {
        newlySaved = true;
        await this.favoriteRepository.create(userId, post.id, tx);
        await this.eventRepository.record(
          { tradePostId: post.id, type: TradePostEventType.SAVE, userId },
          tx,
        );
      }
      await this.favoriteRepository.recomputeSaveCount(post.id, tx);
      return tx.savedTradePost.count({ where: { tradePostId: post.id } });
    });

    if (newlySaved) {
      await this.notifyOwnerOfSave(userId, post.id);
    }
    return { saved: true, saveCount };
  }

  private async notifyOwnerOfSave(
    saverId: string,
    tradePostId: string,
  ): Promise<void> {
    const [post, saver] = await Promise.all([
      this.prisma.tradePost.findUnique({
        where: { id: tradePostId },
        select: { ownerId: true, title: true, slug: true },
      }),
      this.prisma.user.findUnique({
        where: { id: saverId },
        select: { displayName: true },
      }),
    ]);
    if (!post || post.ownerId === saverId) return;
    // Only the first time this user ever saves the post: save/unsave/save
    // toggling must not spam the owner. Each new save records a SAVE event.
    const saves = await this.prisma.tradePostEvent.count({
      where: { tradePostId, userId: saverId, type: TradePostEventType.SAVE },
    });
    if (saves > 1) return;
    await this.notifications.notify(post.ownerId, {
      type: NotificationType.TRADE_POST_SAVED,
      title: 'Có người lưu tin của bạn',
      body: `${saver?.displayName ?? 'Một người dùng'} đã lưu tin "${excerpt(post.title, 80)}".`,
      data: { tradePostId, slug: post.slug },
    });
  }

  /** Removes the user's save. Idempotent — returns silently if not saved. */
  async unsave(userId: string, idOrSlug: string): Promise<void> {
    const post = await this.tradePostRepository.findIdBySlugOrId(idOrSlug);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const removed = await this.favoriteRepository.delete(userId, post.id, tx);
      if (removed > 0) {
        await this.favoriteRepository.recomputeSaveCount(post.id, tx);
      }
    });
  }

  /**
   * The user's saved posts, newest save first. Includes posts that are no
   * longer public (hidden, expired, archived, back in moderation) flagged
   * `isAvailable: false`, so the app can grey them out; deleted posts are dropped.
   */
  async listSaved(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<
    PaginatedResultDto<{
      post: TradePostEntity;
      savedAt: Date;
      isAvailable: boolean;
    }>
  > {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.favoriteRepository.listByUser({
      userId,
      skip,
      take,
    });
    const now = Date.now();
    return paginate(
      items.map((item) => ({
        post: new TradePostEntity(item.tradePost),
        savedAt: item.createdAt,
        isAvailable: isPubliclyVisible(item.tradePost, now),
      })),
      query.page,
      query.limit,
      total,
    );
  }

  /** Ids among `tradePostIds` saved by the viewer; empty for anonymous viewers. */
  async savedPostIds(
    userId: string | undefined,
    tradePostIds: string[],
  ): Promise<Set<string>> {
    if (!userId) return new Set();
    return this.favoriteRepository.findSavedPostIds(userId, tradePostIds);
  }
}
