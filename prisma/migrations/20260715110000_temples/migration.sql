-- CreateEnum
CREATE TYPE "TempleType" AS ENUM ('DINH', 'CHUA', 'MIEU');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'TEMPLE';

-- CreateTable
CREATE TABLE "Temple" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "TempleType" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "openHours" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Temple_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Temple_sortOrder_nonnegative" CHECK ("sortOrder" >= 0),
    CONSTRAINT "Temple_version_positive" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "TempleEvent" (
    "id" TEXT NOT NULL,
    "templeId" TEXT NOT NULL,
    "time" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TempleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Temple_isActive_sortOrder_createdAt_idx" ON "Temple"("isActive", "sortOrder", "createdAt");
CREATE INDEX "Temple_type_isActive_sortOrder_idx" ON "Temple"("type", "isActive", "sortOrder");
CREATE INDEX "Temple_name_idx" ON "Temple"("name");
CREATE INDEX "TempleEvent_templeId_sortOrder_idx" ON "TempleEvent"("templeId", "sortOrder");

ALTER TABLE "Temple" ADD CONSTRAINT "Temple_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Temple" ADD CONSTRAINT "Temple_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Temple" ADD CONSTRAINT "Temple_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TempleEvent" ADD CONSTRAINT "TempleEvent_templeId_fkey" FOREIGN KEY ("templeId") REFERENCES "Temple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
