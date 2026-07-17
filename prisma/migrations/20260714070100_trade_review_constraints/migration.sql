-- One active (non-deleted) review per user per trade post.
-- Cannot be expressed in schema.prisma (Prisma has no filtered/partial unique
-- index support in the schema DSL) — see docs/assumptions.md.
-- IMPORTANT: never regenerate/replace this migration file; add new ones instead.
CREATE UNIQUE INDEX "trade_review_active_unique"
  ON "TradeReview" ("tradePostId", "userId")
  WHERE "deletedAt" IS NULL;

-- Defense-in-depth: rating range is already validated by CreateTradeReviewDto,
-- this guarantees it at the database level too.
ALTER TABLE "TradeReview"
  ADD CONSTRAINT "rating_range" CHECK ("rating" BETWEEN 1 AND 5);
