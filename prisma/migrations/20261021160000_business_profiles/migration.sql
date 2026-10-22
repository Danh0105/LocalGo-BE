CREATE TABLE "BusinessProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessType" "BusinessType" NOT NULL,
  "businessName" VARCHAR(200) NOT NULL,
  "businessCategory" VARCHAR(120) NOT NULL,
  "templeName" VARCHAR(150),
  "openingHours" VARCHAR(100),
  "seatingCapacity" INTEGER,
  "roomCount" INTEGER,
  "gardenArea" VARCHAR(100),
  "mainProducts" VARCHAR(500),
  "contactName" VARCHAR(120) NOT NULL,
  "contactPhone" VARCHAR(30) NOT NULL,
  "contactEmail" VARCHAR(254) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "googleMapsUrl" VARCHAR(2048),
  "lat" DECIMAL(10,7),
  "lng" DECIMAL(10,7),
  "website" VARCHAR(500),
  "facebookUrl" VARCHAR(500),
  "zaloOaUrl" VARCHAR(500),
  "logoUrl" VARCHAR(1000),
  "coverImageUrl" VARCHAR(1000),
  "description" VARCHAR(3000),
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");
CREATE INDEX "BusinessProfile_businessType_isPublic_createdAt_idx"
  ON "BusinessProfile"("businessType", "isPublic", "createdAt");
CREATE INDEX "BusinessProfile_businessName_idx" ON "BusinessProfile"("businessName");
CREATE INDEX "BusinessProfile_deletedAt_idx" ON "BusinessProfile"("deletedAt");

ALTER TABLE "BusinessProfile"
  ADD CONSTRAINT "BusinessProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing approved applications become editable profiles immediately. The
-- newest approved application wins when historical duplicates exist.
INSERT INTO "BusinessProfile" (
  "id", "userId", "businessType", "businessName", "businessCategory",
  "templeName", "openingHours", "seatingCapacity", "roomCount",
  "gardenArea", "mainProducts", "contactName", "contactPhone",
  "contactEmail", "address", "website", "description", "isPublic",
  "version", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  source."createdUserId",
  source."businessType",
  source."businessName",
  source."businessCategory",
  source."templeName",
  source."openingHours",
  source."seatingCapacity",
  source."roomCount",
  source."gardenArea",
  source."mainProducts",
  source."contactName",
  source."contactPhone",
  source."contactEmail",
  source."address",
  source."website",
  source."description",
  true,
  1,
  source."createdAt",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (application."createdUserId") application.*
  FROM "BusinessApplication" application
  JOIN "User" account ON account.id = application."createdUserId"
  WHERE application.status = 'APPROVED'
    AND application."createdUserId" IS NOT NULL
    AND account.role = 'BUSINESS'
    AND account."deletedAt" IS NULL
  ORDER BY application."createdUserId", application."reviewedAt" DESC NULLS LAST,
    application."createdAt" DESC
) source;
