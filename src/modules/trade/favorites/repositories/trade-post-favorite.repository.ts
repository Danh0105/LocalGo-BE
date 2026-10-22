import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import type { TradePostWithCategory } from '../../posts/entities/trade-post.entity';

export type SavedTradePostWithPost = {
  createdAt: Date;
  tradePost: TradePostWithCategory;
};

@Injectable()
export class TradePostFavoriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSaved(
    userId: string,
    tradePostId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<{ id: string } | null> {
    return client.savedTradePost.findUnique({
      where: { userId_tradePostId: { userId, tradePostId } },
      select: { id: true },
    });
  }

  /** Which of `tradePostIds` the user has saved (one query for a whole list page). */
  async findSavedPostIds(
    userId: string,
    tradePostIds: string[],
  ): Promise<Set<string>> {
    if (tradePostIds.length === 0) return new Set();
    const rows = await this.prisma.savedTradePost.findMany({
      where: { userId, tradePostId: { in: tradePostIds } },
      select: { tradePostId: true },
    });
    return new Set(rows.map((row) => row.tradePostId));
  }

  async create(
    userId: string,
    tradePostId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.savedTradePost.create({ data: { userId, tradePostId } });
  }

  async delete(
    userId: string,
    tradePostId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.savedTradePost.deleteMany({
      where: { userId, tradePostId },
    });
    return result.count;
  }

  /**
   * Recomputes TradePost.saveCount from the actual SavedTradePost rows — never
   * a naive increment/decrement — so the denormalized counter can't drift.
   * Mirrors the TradeRatingService.recompute pattern.
   */
  async recomputeSaveCount(
    tradePostId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`
      UPDATE "TradePost" SET "saveCount" = (
        SELECT COUNT(*)::int FROM "SavedTradePost" WHERE "tradePostId" = ${tradePostId}
      ) WHERE id = ${tradePostId}`;
  }

  async listByUser(params: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<{ items: SavedTradePostWithPost[]; total: number }> {
    const where: Prisma.SavedTradePostWhereInput = {
      userId: params.userId,
      tradePost: { deletedAt: null },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.savedTradePost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          createdAt: true,
          tradePost: { include: { category: true } },
        },
      }),
      this.prisma.savedTradePost.count({ where }),
    ]);
    return { items, total };
  }
}
