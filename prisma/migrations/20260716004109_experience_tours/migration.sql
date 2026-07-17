-- CreateEnum
CREATE TYPE "ExperienceTourCategory" AS ENUM ('NUA_NGAY', 'MOT_NGAY', 'GIA_DINH', 'HOC_SINH', 'NONG_NGHIEP');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'EXPERIENCE_TOUR';

-- CreateTable
CREATE TABLE "ExperienceTour" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "ExperienceTourCategory" NOT NULL,
    "duration" VARCHAR(100) NOT NULL,
    "startTime" VARCHAR(100) NOT NULL,
    "priceRange" VARCHAR(100) NOT NULL,
    "meetingPoint" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "itinerary" JSONB NOT NULL,
    "included" JSONB NOT NULL,
    "note" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceTour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExperienceTour_isActive_sortOrder_createdAt_idx" ON "ExperienceTour"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ExperienceTour_category_isActive_sortOrder_idx" ON "ExperienceTour"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ExperienceTour_name_idx" ON "ExperienceTour"("name");

-- AddForeignKey
ALTER TABLE "ExperienceTour" ADD CONSTRAINT "ExperienceTour_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceTour" ADD CONSTRAINT "ExperienceTour_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceTour" ADD CONSTRAINT "ExperienceTour_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
