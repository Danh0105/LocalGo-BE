-- ExtendEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'BUSINESS_APPLICATION';

-- CreateEnum
CREATE TYPE "BusinessApplicantType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "BusinessApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BusinessDocumentType" AS ENUM ('IDENTITY_FRONT', 'IDENTITY_BACK', 'BUSINESS_LICENSE', 'TAX_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "BusinessApplication" (
    "id" TEXT NOT NULL,
    "applicantType" "BusinessApplicantType" NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessCategory" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "identityNumber" TEXT,
    "identityIssuedAt" TIMESTAMP(3),
    "identityIssuedPlace" TEXT,
    "legalName" TEXT,
    "taxCode" TEXT,
    "representativeName" TEXT,
    "representativeTitle" TEXT,
    "website" TEXT,
    "description" TEXT,
    "status" "BusinessApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "BusinessDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessApplication_createdUserId_key" ON "BusinessApplication"("createdUserId");
CREATE INDEX "BusinessApplication_status_createdAt_idx" ON "BusinessApplication"("status", "createdAt");
CREATE INDEX "BusinessApplication_applicantType_idx" ON "BusinessApplication"("applicantType");
CREATE INDEX "BusinessApplication_contactEmail_idx" ON "BusinessApplication"("contactEmail");
CREATE INDEX "BusinessApplication_taxCode_idx" ON "BusinessApplication"("taxCode");
CREATE INDEX "BusinessApplication_submittedById_createdAt_idx" ON "BusinessApplication"("submittedById", "createdAt");
CREATE UNIQUE INDEX "BusinessApplicationDocument_applicationId_mediaId_key" ON "BusinessApplicationDocument"("applicationId", "mediaId");
CREATE INDEX "BusinessApplicationDocument_applicationId_idx" ON "BusinessApplicationDocument"("applicationId");

-- AddForeignKey
ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessApplicationDocument" ADD CONSTRAINT "BusinessApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "BusinessApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessApplicationDocument" ADD CONSTRAINT "BusinessApplicationDocument_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
