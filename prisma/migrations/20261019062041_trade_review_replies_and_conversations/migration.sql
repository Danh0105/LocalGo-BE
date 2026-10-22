-- Seller replies on reviews + customer/owner chat for trade posts.

-- AlterTable
ALTER TABLE "TradeReview" ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "replyContent" VARCHAR(500);

-- CreateTable
CREATE TABLE "TradeConversation" (
    "id" TEXT NOT NULL,
    "tradePostId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeConversation_ownerId_lastMessageAt_idx" ON "TradeConversation"("ownerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "TradeConversation_customerId_lastMessageAt_idx" ON "TradeConversation"("customerId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "TradeConversation_tradePostId_customerId_key" ON "TradeConversation"("tradePostId", "customerId");

-- CreateIndex
CREATE INDEX "TradeMessage_conversationId_createdAt_idx" ON "TradeMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeMessage_conversationId_senderId_readAt_idx" ON "TradeMessage"("conversationId", "senderId", "readAt");

-- AddForeignKey
ALTER TABLE "TradeConversation" ADD CONSTRAINT "TradeConversation_tradePostId_fkey" FOREIGN KEY ("tradePostId") REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeConversation" ADD CONSTRAINT "TradeConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeConversation" ADD CONSTRAINT "TradeConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeMessage" ADD CONSTRAINT "TradeMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TradeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeMessage" ADD CONSTRAINT "TradeMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
