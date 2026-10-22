-- CreateEnum
CREATE TYPE "ContentReviewTargetType" AS ENUM ('TEMPLE', 'SPECIALTY', 'HISTORICAL_SITE', 'AGRICULTURE', 'CRAFT_VILLAGE', 'CUISINE', 'FESTIVAL', 'EXPERIENCE_TOUR');

-- CreateEnum
CREATE TYPE "ContentReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "targetType" "ContentReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "replyContent" VARCHAR(1000),
    "repliedAt" TIMESTAMP(3),
    "repliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReviewImage" (
    "id" TEXT NOT NULL,
    "contentReviewId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReviewImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReview_targetType_targetId_status_createdAt_idx" ON "ContentReview"("targetType", "targetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReview_userId_createdAt_idx" ON "ContentReview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReview_status_createdAt_idx" ON "ContentReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReviewImage_mediaId_idx" ON "ContentReviewImage"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReviewImage_contentReviewId_mediaId_key" ON "ContentReviewImage"("contentReviewId", "mediaId");

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReviewImage" ADD CONSTRAINT "ContentReviewImage_contentReviewId_fkey" FOREIGN KEY ("contentReviewId") REFERENCES "ContentReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReviewImage" ADD CONSTRAINT "ContentReviewImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One active (non-deleted) review per user per content item. Not expressible
-- in schema.prisma (no partial unique index support) — same approach as
-- "trade_review_active_unique". Never regenerate this migration.
CREATE UNIQUE INDEX "content_review_active_unique"
  ON "ContentReview" ("targetType", "targetId", "userId")
  WHERE "deletedAt" IS NULL;

-- Defense-in-depth: the DTO already validates 1..5.
ALTER TABLE "ContentReview"
  ADD CONSTRAINT "content_review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
