-- CreateTable
CREATE TABLE "HarvestBatch" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" VARCHAR(120) NOT NULL,
    "fruitName" VARCHAR(120) NOT NULL,
    "harvestDate" DATE NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pricePerKg" DECIMAL(14,0) NOT NULL,
    "fertilizers" VARCHAR(2000) NOT NULL,
    "pesticides" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HarvestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestBatch_code_key" ON "HarvestBatch"("code");

-- CreateIndex
CREATE INDEX "HarvestBatch_ownerId_harvestDate_idx" ON "HarvestBatch"("ownerId", "harvestDate");

-- AddForeignKey
ALTER TABLE "HarvestBatch" ADD CONSTRAINT "HarvestBatch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
