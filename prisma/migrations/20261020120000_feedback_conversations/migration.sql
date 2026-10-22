-- CreateEnum
CREATE TYPE "FeedbackMessageSenderRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderRole" "FeedbackMessageSenderRole" NOT NULL,
    "senderUserId" TEXT,
    "content" VARCHAR(5000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackMessageMedia" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessageMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackMessage_ticketId_createdAt_idx" ON "FeedbackMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackMessage_senderUserId_idx" ON "FeedbackMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "FeedbackMessageMedia_messageId_sortOrder_idx" ON "FeedbackMessageMedia"("messageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackMessageMedia_messageId_mediaId_key" ON "FeedbackMessageMedia"("messageId", "mediaId");

-- AddForeignKey
ALTER TABLE "FeedbackMessage"
  ADD CONSTRAINT "FeedbackMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "FeedbackTicket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackMessage"
  ADD CONSTRAINT "FeedbackMessage_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackMessageMedia"
  ADD CONSTRAINT "FeedbackMessageMedia_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "FeedbackMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackMessageMedia"
  ADD CONSTRAINT "FeedbackMessageMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing tickets become complete conversations: the original submission is
-- the first user message, with the same timestamp and attachment ordering.
INSERT INTO "FeedbackMessage" (
  "id", "ticketId", "senderRole", "senderUserId", "content", "createdAt"
)
SELECT
  'initial-' || ticket."id",
  ticket."id",
  'USER'::"FeedbackMessageSenderRole",
  ticket."submittedById",
  ticket."content",
  ticket."createdAt"
FROM "FeedbackTicket" AS ticket;

INSERT INTO "FeedbackMessageMedia" (
  "id", "messageId", "mediaId", "sortOrder", "createdAt"
)
SELECT
  'initial-' || attachment."id",
  'initial-' || attachment."ticketId",
  attachment."mediaId",
  attachment."sortOrder",
  attachment."createdAt"
FROM "FeedbackTicketMedia" AS attachment;
