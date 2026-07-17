-- CreateEnum
CREATE TYPE "CraftVillageCategory" AS ENUM ('THU_CONG_TRUYEN_THONG', 'CHE_BIEN_NONG_SAN', 'DICH_VU_TRAI_NGHIEM', 'SAN_PHAM_GIA_DINH');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'CRAFT_VILLAGE';

-- CreateTable
CREATE TABLE "CraftVillage" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "CraftVillageCategory" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "workingTime" VARCHAR(100) NOT NULL,
    "mainProducts" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "visitorNote" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftVillage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CraftVillage_isActive_sortOrder_createdAt_idx" ON "CraftVillage"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "CraftVillage_category_isActive_sortOrder_idx" ON "CraftVillage"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CraftVillage_name_idx" ON "CraftVillage"("name");

-- AddForeignKey
ALTER TABLE "CraftVillage" ADD CONSTRAINT "CraftVillage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftVillage" ADD CONSTRAINT "CraftVillage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftVillage" ADD CONSTRAINT "CraftVillage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
