ALTER TABLE "CuisineItem"
ADD COLUMN "contactPhone" VARCHAR(30) NOT NULL DEFAULT '',
ADD COLUMN "menu" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "reviews" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "CuisineItemImage" (
    "id" TEXT NOT NULL,
    "cuisineItemId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuisineItemImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuisineItemImage_cuisineItemId_mediaId_key"
ON "CuisineItemImage"("cuisineItemId", "mediaId");

CREATE INDEX "CuisineItemImage_cuisineItemId_sortOrder_idx"
ON "CuisineItemImage"("cuisineItemId", "sortOrder");

ALTER TABLE "CuisineItemImage"
ADD CONSTRAINT "CuisineItemImage_cuisineItemId_fkey"
FOREIGN KEY ("cuisineItemId") REFERENCES "CuisineItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CuisineItemImage"
ADD CONSTRAINT "CuisineItemImage_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "Media"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
