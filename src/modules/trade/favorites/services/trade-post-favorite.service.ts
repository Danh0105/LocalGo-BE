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
import { TradePostEntity } from '../../posts/entities/trade-post.entity';
import { TradePostEventRepository } from '../../posts/repositories/trade-post-event.repository';
import { TradePostRepository } from '../../posts/repositories/trade-post.repository';
import { TradePostFavoriteRepository } from '../repositories/trade-post-favorite.repository';

@Injectable()
export class TradePostFavoriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly favoriteRepository: TradePostFavoriteRepository,
    private readonly tradePostRepository: TradePostRepository,
    private readonly eventRepository: TradePostEventRepository,
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

    const saveCount = await this.prisma.$transaction(async (tx) => {
      const existing = await this.favoriteRepository.findSaved(
        userId,
        post.id,
        tx,
      );
      if (!existing) {
        await this.favoriteRepository.create(userId, post.id, tx);
        await this.eventRepository.record(
          { tradePostId: post.id, type: TradePostEventType.SAVE, userId },
          tx,
        );
      }
      await this.favoriteRepository.recomputeSaveCount(post.id, tx);
      return tx.savedTradePost.count({ where: { tradePostId: post.id } });
    });

    return { saved: true, saveCount };
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

  async listSaved(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResultDto<TradePostEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.favoriteRepository.listByUser({
      userId,
      skip,
      take,
    });
    return paginate(
      items.map((item) => new TradePostEntity(item.tradePost)),
      query.page,
      query.limit,
      total,
    );
  }
}
