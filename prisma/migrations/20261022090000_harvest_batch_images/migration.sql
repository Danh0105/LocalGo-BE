-- AddEnumValue
ALTER TYPE "MediaResourceType" ADD VALUE 'HARVEST_BATCH';

-- CreateTable
CREATE TABLE "HarvestBatchImage" (
    "id" TEXT NOT NULL,
    "harvestBatchId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarvestBatchImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestBatchImage_harvestBatchId_mediaId_key" ON "HarvestBatchImage"("harvestBatchId", "mediaId");

-- CreateIndex
CREATE INDEX "HarvestBatchImage_harvestBatchId_sortOrder_idx" ON "HarvestBatchImage"("harvestBatchId", "sortOrder");

-- AddForeignKey
ALTER TABLE "HarvestBatchImage" ADD CONSTRAINT "HarvestBatchImage_harvestBatchId_fkey" FOREIGN KEY ("harvestBatchId") REFERENCES "HarvestBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestBatchImage" ADD CONSTRAINT "HarvestBatchImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
