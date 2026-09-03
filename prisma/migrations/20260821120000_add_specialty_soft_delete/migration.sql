-- Add soft-delete support for specialties while preserving their unique IDs/slugs.
ALTER TABLE "Specialty" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Specialty_deletedAt_idx" ON "Specialty"("deletedAt");
