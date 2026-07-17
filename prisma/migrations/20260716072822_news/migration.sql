-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('THONG_BAO', 'HOAT_DONG_XA', 'DU_LICH', 'NONG_NGHIEP', 'CHUYEN_DOI_SO');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'NEWS_ARTICLE';

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "author" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "content" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "relatedLinks" JSONB NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsArticle_isActive_publishedAt_idx" ON "NewsArticle"("isActive", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_category_isActive_publishedAt_idx" ON "NewsArticle"("category", "isActive", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_title_idx" ON "NewsArticle"("title");

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
