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
 * Concurrency safety: under READ COMMITTED, when an UPDATE blocks on a
 * row lock held by another transaction, PostgreSQL's EvalPlanQual re-check
 * only refreshes the *target* row (TradePost) once the lock is released —
 * it does NOT take a new snapshot for correlated subqueries against other
 * tables (TradeReview) in the same statement. Those subqueries can still
 * see the pre-wait snapshot and miss reviews committed by the transaction
 * we were blocked on, causing a lost update. To avoid this we first take
 * an explicit `SELECT ... FOR UPDATE` on the TradePost row (this blocks
 * until any concurrent recompute commits), then run the aggregate UPDATE
 * as a separate statement — which, under READ COMMITTED, gets a fresh
 * snapshot at its own start and is guaranteed to see all previously
 * committed review changes.
 */
@Injectable()
export class TradeRatingService {
  async recompute(
    tx: Prisma.TransactionClient,
    tradePostId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      SELECT id FROM "TradePost" WHERE id = ${tradePostId} FOR UPDATE`;

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
