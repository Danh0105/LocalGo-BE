-- ExtendEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'ABOUT';

-- CreateTable
CREATE TABLE "AboutPage" (
    "id" TEXT NOT NULL DEFAULT 'about',
    "draftSnapshot" JSONB NOT NULL,
    "publishedSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AboutRevision" (
    "id" TEXT NOT NULL,
    "aboutPageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AboutRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AboutRevision_aboutPageId_version_key" ON "AboutRevision"("aboutPageId", "version");
CREATE INDEX "AboutRevision_aboutPageId_publishedAt_idx" ON "AboutRevision"("aboutPageId", "publishedAt");

-- AddForeignKey
ALTER TABLE "AboutPage" ADD CONSTRAINT "AboutPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AboutPage" ADD CONSTRAINT "AboutPage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AboutPage" ADD CONSTRAINT "AboutPage_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AboutRevision" ADD CONSTRAINT "AboutRevision_aboutPageId_fkey" FOREIGN KEY ("aboutPageId") REFERENCES "AboutPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AboutRevision" ADD CONSTRAINT "AboutRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
