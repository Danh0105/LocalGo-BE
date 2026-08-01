-- CreateEnum
CREATE TYPE "TradePostEventType" AS ENUM ('VIEW', 'CONTACT_PHONE', 'CONTACT_ZALO', 'SHARE', 'SAVE');

-- AlterTable
ALTER TABLE "TradePost" ADD COLUMN     "saveCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TradePostEvent" (
    "id" TEXT NOT NULL,
    "tradePostId" TEXT NOT NULL,
    "type" "TradePostEventType" NOT NULL,
    "userId" TEXT,
    "visitorHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradePostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTradePost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradePostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedTradePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradePostEvent_tradePostId_type_createdAt_idx" ON "TradePostEvent"("tradePostId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "TradePostEvent_tradePostId_createdAt_idx" ON "TradePostEvent"("tradePostId", "createdAt");

-- CreateIndex
CREATE INDEX "TradePostEvent_createdAt_idx" ON "TradePostEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SavedTradePost_tradePostId_idx" ON "SavedTradePost"("tradePostId");

-- CreateIndex
CREATE INDEX "SavedTradePost_userId_createdAt_idx" ON "SavedTradePost"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedTradePost_userId_tradePostId_key" ON "SavedTradePost"("userId", "tradePostId");

-- AddForeignKey
ALTER TABLE "TradePostEvent" ADD CONSTRAINT "TradePostEvent_tradePostId_fkey" FOREIGN KEY ("tradePostId") REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePostEvent" ADD CONSTRAINT "TradePostEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTradePost" ADD CONSTRAINT "SavedTradePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTradePost" ADD CONSTRAINT "SavedTradePost_tradePostId_fkey" FOREIGN KEY ("tradePostId") REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
