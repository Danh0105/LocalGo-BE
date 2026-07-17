-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('HANH_CHINH', 'KHAN_CAP', 'DU_LICH', 'NONG_NGHIEP', 'PHAN_ANH');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'CONTACT';

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "ContactCategory" NOT NULL,
    "role" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "address" VARCHAR(255) NOT NULL,
    "workingTime" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "supportTopics" JSONB NOT NULL,
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

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_isActive_sortOrder_createdAt_idx" ON "Contact"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_category_isActive_sortOrder_idx" ON "Contact"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
