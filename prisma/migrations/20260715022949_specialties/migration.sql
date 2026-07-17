-- CreateEnum
CREATE TYPE "SpecialtyCategory" AS ENUM ('MON_AN', 'TRAI_CAY', 'QUA_MANG_VE');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'SPECIALTY';

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "SpecialtyCategory" NOT NULL,
    "price" VARCHAR(100) NOT NULL,
    "season" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "buyPlaces" JSONB NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Specialty_isActive_sortOrder_createdAt_idx" ON "Specialty"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Specialty_category_isActive_sortOrder_idx" ON "Specialty"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Specialty_name_idx" ON "Specialty"("name");

-- AddForeignKey
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
