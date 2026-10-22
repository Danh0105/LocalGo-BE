CREATE TYPE "MapLocationSource" AS ENUM ('MAP_PLACE', 'CUISINE', 'TEMPLE', 'HISTORICAL_SITE');
CREATE TYPE "MapLocationStatus" AS ENUM ('PENDING', 'RESOLVED', 'UNRESOLVED', 'FAILED');

CREATE TABLE "MapLocationResolution" (
    "id" TEXT NOT NULL,
    "source" "MapLocationSource" NOT NULL,
    "sourceId" VARCHAR(191) NOT NULL,
    "subId" VARCHAR(191) NOT NULL DEFAULT '',
    "googleMapsUrl" VARCHAR(2048) NOT NULL,
    "urlHash" CHAR(64) NOT NULL,
    "status" "MapLocationStatus" NOT NULL DEFAULT 'PENDING',
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "resolvedAt" TIMESTAMP(3),
    "reasonCode" VARCHAR(64),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapLocationResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MapLocationResolution_source_sourceId_subId_key"
ON "MapLocationResolution"("source", "sourceId", "subId");
CREATE INDEX "MapLocationResolution_status_nextAttemptAt_lockedAt_idx"
ON "MapLocationResolution"("status", "nextAttemptAt", "lockedAt");
CREATE INDEX "MapLocationResolution_source_sourceId_idx"
ON "MapLocationResolution"("source", "sourceId");
