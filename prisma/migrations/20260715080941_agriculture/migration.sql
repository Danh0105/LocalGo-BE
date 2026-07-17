-- CreateEnum
CREATE TYPE "AgricultureCategory" AS ENUM ('CAY_TRONG_CHU_LUC', 'CHAN_NUOI', 'THUY_LOI', 'MO_HINH_SAN_XUAT');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'AGRICULTURE';

-- CreateTable
CREATE TABLE "AgricultureItem" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "AgricultureCategory" NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "season" VARCHAR(150) NOT NULL,
    "scale" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "support" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgricultureItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgricultureItem_isActive_sortOrder_createdAt_idx" ON "AgricultureItem"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "AgricultureItem_category_isActive_sortOrder_idx" ON "AgricultureItem"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AgricultureItem_name_idx" ON "AgricultureItem"("name");

-- AddForeignKey
ALTER TABLE "AgricultureItem" ADD CONSTRAINT "AgricultureItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgricultureItem" ADD CONSTRAINT "AgricultureItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgricultureItem" ADD CONSTRAINT "AgricultureItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
