-- CreateEnum
CREATE TYPE "MapPlaceCategory" AS ENUM ('HANH_CHINH', 'DU_LICH', 'DI_TICH', 'AM_THUC', 'DICH_VU');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'MAP_PLACE';

-- CreateTable
CREATE TABLE "MapPlace" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "MapPlaceCategory" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "openTime" VARCHAR(150) NOT NULL,
    "distanceFromCenter" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "directionNote" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapPlace_isActive_sortOrder_createdAt_idx" ON "MapPlace"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "MapPlace_category_isActive_sortOrder_idx" ON "MapPlace"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MapPlace_name_idx" ON "MapPlace"("name");

-- AddForeignKey
ALTER TABLE "MapPlace" ADD CONSTRAINT "MapPlace_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPlace" ADD CONSTRAINT "MapPlace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPlace" ADD CONSTRAINT "MapPlace_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
