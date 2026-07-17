-- CreateEnum
CREATE TYPE "OcopCategory" AS ENUM ('THUC_PHAM', 'DO_UONG', 'NONG_SAN_TUOI', 'SAN_PHAM_CHE_BIEN');

-- CreateEnum
CREATE TYPE "OcopRating" AS ENUM ('THREE', 'FOUR', 'FIVE');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'OCOP';

-- CreateTable
CREATE TABLE "OcopProduct" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "OcopCategory" NOT NULL,
    "rating" "OcopRating" NOT NULL,
    "producer" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "priceRange" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "contactNote" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcopProduct_isActive_sortOrder_createdAt_idx" ON "OcopProduct"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "OcopProduct_category_isActive_sortOrder_idx" ON "OcopProduct"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "OcopProduct_rating_isActive_sortOrder_idx" ON "OcopProduct"("rating", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "OcopProduct_name_idx" ON "OcopProduct"("name");

-- AddForeignKey
ALTER TABLE "OcopProduct" ADD CONSTRAINT "OcopProduct_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcopProduct" ADD CONSTRAINT "OcopProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcopProduct" ADD CONSTRAINT "OcopProduct_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
