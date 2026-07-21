-- Move trade post categories from the Prisma enum into a managed table.
-- The old PostgreSQL enum type must be renamed first because table names and
-- types share the same schema namespace.

ALTER TYPE "TradePostCategory" RENAME TO "TradePostCategory_old";

CREATE TABLE "TradePostCategory" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresPromotionDetails" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TradePostCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradePostCategory_code_key" ON "TradePostCategory"("code");
CREATE INDEX "TradePostCategory_isActive_sortOrder_idx" ON "TradePostCategory"("isActive", "sortOrder");
CREATE INDEX "TradePostCategory_deletedAt_idx" ON "TradePostCategory"("deletedAt");

ALTER TABLE "TradePostCategory"
ADD CONSTRAINT "TradePostCategory_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradePostCategory"
ADD CONSTRAINT "TradePostCategory_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TradePostCategory" (
    "id",
    "code",
    "name",
    "description",
    "sortOrder",
    "requiresPromotionDetails"
)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'PRODUCT', 'Sản phẩm', 'Đặc sản và sản phẩm địa phương', 0, false),
    ('22222222-2222-4222-8222-222222222222', 'SERVICE', 'Dịch vụ', 'Kết nối dịch vụ và tiện ích', 1, false),
    ('33333333-3333-4333-8333-333333333333', 'BUY_REQUEST', 'Cần mua', 'Tìm sản phẩm, dịch vụ và đối tác', 2, false),
    ('44444444-4444-4444-8444-444444444444', 'PROMOTION', 'Khuyến mãi', 'Ưu đãi và chương trình khuyến mãi', 3, true)
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "sortOrder" = EXCLUDED."sortOrder",
    "requiresPromotionDetails" = EXCLUDED."requiresPromotionDetails",
    "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "TradePost" ADD COLUMN "categoryId" TEXT;

UPDATE "TradePost"
SET "categoryId" = "TradePostCategory"."id"
FROM "TradePostCategory"
WHERE "TradePost"."category"::text = "TradePostCategory"."code";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "TradePost" WHERE "categoryId" IS NULL) THEN
        RAISE EXCEPTION 'Cannot migrate TradePost.category: some rows could not be backfilled';
    END IF;
END $$;

ALTER TABLE "TradePost" ALTER COLUMN "categoryId" SET NOT NULL;
CREATE INDEX "TradePost_categoryId_idx" ON "TradePost"("categoryId");

ALTER TABLE "TradePost"
ADD CONSTRAINT "TradePost_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "TradePostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "TradePost_category_idx";
ALTER TABLE "TradePost" DROP COLUMN "category";
DROP TYPE "TradePostCategory_old";
