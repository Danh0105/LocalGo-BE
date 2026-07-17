import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';

/**
 * Recomputes TradePost.averageRating/reviewCount from the actual set of
 * PUBLISHED, non-deleted TradeReview rows for that post — never a naive
 * increment/decrement. Must always be called from inside the same
 * transaction as the review mutation that triggered it (create-doesn't-
 * need-it since new reviews start PENDING; publish/hide/soft-delete/edit-
 * that-reverts-status all do).
 *
 * Concurrency safety: the UPDATE statement's subqueries are evaluated at
 * execution time, and the UPDATE itself takes Postgres's row lock on the
 * target TradePost row — a second concurrent transaction targeting the same
 * post blocks until the first commits, then sees its committed review
 * changes. No explicit `SELECT ... FOR UPDATE` is needed as long as the
 * aggregate is read and written in this single statement; if the aggregate
 * is ever split into a separate SELECT before the UPDATE, an explicit
 * `FOR UPDATE` becomes mandatory to avoid a lost-update race.
 */
@Injectable()
export class TradeRatingService {
  async recompute(
    tx: Prisma.TransactionClient,
    tradePostId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "TradePost" SET
        "averageRating" = COALESCE((
          SELECT ROUND(AVG(rating)::numeric, 1) FROM "TradeReview"
          WHERE "tradePostId" = ${tradePostId} AND status = 'PUBLISHED' AND "deletedAt" IS NULL
        ), 0),
        "reviewCount" = (
          SELECT COUNT(*)::int FROM "TradeReview"
          WHERE "tradePostId" = ${tradePostId} AND status = 'PUBLISHED' AND "deletedAt" IS NULL
        )
      WHERE id = ${tradePostId}`;
  }
}
