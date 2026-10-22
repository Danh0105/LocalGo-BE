-- Trade reviews are post-moderated: they go public as soon as they are
-- posted, and admins can only hide/delete them afterwards.

-- AlterTable
ALTER TABLE "TradeReview" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';

-- Publish the reviews still waiting in the old approval queue...
UPDATE "TradeReview" SET "status" = 'PUBLISHED' WHERE "status" = 'PENDING';

-- ...and refresh the rating aggregates (same formula as TradeRatingService).
UPDATE "TradePost" p SET
  "averageRating" = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 1) FROM "TradeReview" r
    WHERE r."tradePostId" = p.id AND r.status = 'PUBLISHED' AND r."deletedAt" IS NULL
  ), 0),
  "reviewCount" = (
    SELECT COUNT(*)::int FROM "TradeReview" r
    WHERE r."tradePostId" = p.id AND r.status = 'PUBLISHED' AND r."deletedAt" IS NULL
  )
WHERE EXISTS (SELECT 1 FROM "TradeReview" r WHERE r."tradePostId" = p.id);
