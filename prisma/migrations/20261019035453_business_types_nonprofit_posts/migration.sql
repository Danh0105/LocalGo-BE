-- Loại hình tài khoản đăng tin (form đăng ký theo loại hình) và tin phi lợi nhuận.

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('TEMPLE_MANAGEMENT', 'RESTAURANT', 'ACCOMMODATION', 'GARDEN', 'GENERAL');

-- CreateEnum
CREATE TYPE "TradePostPurpose" AS ENUM ('COMMERCIAL', 'NON_PROFIT');

-- AlterEnum (PostgreSQL 12+ allows several ADD VALUE in one transaction as
-- long as the new values are not used in it)
ALTER TYPE "BusinessDocumentType" ADD VALUE 'MANAGEMENT_DECISION';
ALTER TYPE "BusinessDocumentType" ADD VALUE 'FOOD_SAFETY_CERTIFICATE';
ALTER TYPE "BusinessDocumentType" ADD VALUE 'SECURITY_CERTIFICATE';
ALTER TYPE "BusinessDocumentType" ADD VALUE 'LAND_USE_CERTIFICATE';

-- AlterTable: existing applications keep today's rules as GENERAL
ALTER TABLE "BusinessApplication" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "gardenArea" TEXT,
ADD COLUMN     "mainProducts" TEXT,
ADD COLUMN     "openingHours" TEXT,
ADD COLUMN     "roomCount" INTEGER,
ADD COLUMN     "seatingCapacity" INTEGER,
ADD COLUMN     "templeName" TEXT;

-- AlterTable: existing posts stay COMMERCIAL; NON_PROFIT posts have no price type
ALTER TABLE "TradePost" ADD COLUMN     "eventEndAt" TIMESTAMP(3),
ADD COLUMN     "eventStartAt" TIMESTAMP(3),
ADD COLUMN     "purpose" "TradePostPurpose" NOT NULL DEFAULT 'COMMERCIAL',
ALTER COLUMN "priceType" DROP NOT NULL;

-- AlterTable: null = GENERAL (accounts approved before business types existed)
ALTER TABLE "User" ADD COLUMN     "businessType" "BusinessType";

-- CreateIndex
CREATE INDEX "BusinessApplication_businessType_idx" ON "BusinessApplication"("businessType");

-- CreateIndex
CREATE INDEX "TradePost_purpose_idx" ON "TradePost"("purpose");

-- Category for non-profit event posts (e.g. temple festivals). Appended after
-- the existing categories; left untouched if an admin already created EVENT.
INSERT INTO "TradePostCategory" ("id", "code", "name", "description", "sortOrder", "requiresPromotionDetails")
SELECT
    '55555555-5555-4555-8555-555555555555',
    'EVENT',
    'Sự kiện – Lễ hội',
    'Quảng bá lễ hội, ngày hội và sự kiện cộng đồng',
    COALESCE(MAX("sortOrder"), -1) + 1,
    false
FROM "TradePostCategory"
ON CONFLICT ("code") DO NOTHING;
