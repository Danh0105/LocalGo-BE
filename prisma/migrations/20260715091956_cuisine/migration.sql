-- CreateEnum
CREATE TYPE "CuisineCategory" AS ENUM ('MON_NUOC', 'MON_NUONG', 'MON_CUON', 'AN_VAT', 'MON_CHAY');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'CUISINE';

-- CreateTable
CREATE TABLE "CuisineItem" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "CuisineCategory" NOT NULL,
    "priceRange" VARCHAR(100) NOT NULL,
    "bestTime" VARCHAR(100) NOT NULL,
    "suggestedPlaces" JSONB NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "tip" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuisineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuisineItem_isActive_sortOrder_createdAt_idx" ON "CuisineItem"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "CuisineItem_category_isActive_sortOrder_idx" ON "CuisineItem"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CuisineItem_name_idx" ON "CuisineItem"("name");

-- AddForeignKey
ALTER TABLE "CuisineItem" ADD CONSTRAINT "CuisineItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuisineItem" ADD CONSTRAINT "CuisineItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuisineItem" ADD CONSTRAINT "CuisineItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
