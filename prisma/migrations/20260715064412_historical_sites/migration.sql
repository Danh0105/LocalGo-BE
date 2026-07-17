-- CreateEnum
CREATE TYPE "HistoricalSiteRank" AS ENUM ('CAP_QUOC_GIA', 'CAP_TINH', 'CHUA_XEP_HANG');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'HISTORICAL_SITE';

-- CreateTable
CREATE TABLE "HistoricalSite" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "rank" "HistoricalSiteRank" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "recognizedYear" INTEGER,
    "summary" VARCHAR(300) NOT NULL,
    "history" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalSite_isActive_sortOrder_createdAt_idx" ON "HistoricalSite"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "HistoricalSite_rank_isActive_sortOrder_idx" ON "HistoricalSite"("rank", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "HistoricalSite_name_idx" ON "HistoricalSite"("name");

-- AddForeignKey
ALTER TABLE "HistoricalSite" ADD CONSTRAINT "HistoricalSite_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalSite" ADD CONSTRAINT "HistoricalSite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalSite" ADD CONSTRAINT "HistoricalSite_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
