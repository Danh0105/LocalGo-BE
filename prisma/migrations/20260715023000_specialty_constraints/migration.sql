-- AlterTable
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "Specialty" ADD CONSTRAINT "Specialty_version_positive" CHECK ("version" > 0);
