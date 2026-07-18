-- AlterTable
ALTER TABLE "BusinessApplication" ADD COLUMN     "zaloAvatarUrl" TEXT,
ADD COLUMN     "zaloDisplayName" TEXT,
ADD COLUMN     "zaloId" TEXT;

-- CreateIndex
CREATE INDEX "BusinessApplication_zaloId_createdAt_idx" ON "BusinessApplication"("zaloId", "createdAt");
