-- CreateEnum
CREATE TYPE "FestivalCategory" AS ENUM ('LE_TRUYEN_THONG', 'VAN_HOA_CONG_DONG', 'THE_THAO_VUI_CHOI', 'SU_KIEN_NONG_SAN');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'FESTIVAL';

-- CreateTable
CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "FestivalCategory" NOT NULL,
    "time" VARCHAR(150) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "scale" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "activities" JSONB NOT NULL,
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

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Festival_isActive_sortOrder_createdAt_idx" ON "Festival"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Festival_category_isActive_sortOrder_idx" ON "Festival"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Festival_name_idx" ON "Festival"("name");

-- AddForeignKey
ALTER TABLE "Festival" ADD CONSTRAINT "Festival_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Festival" ADD CONSTRAINT "Festival_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Festival" ADD CONSTRAINT "Festival_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
