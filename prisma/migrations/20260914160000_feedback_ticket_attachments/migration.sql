-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'FEEDBACK_TICKET';

-- DropForeignKey
ALTER TABLE "Media" DROP CONSTRAINT "Media_ownerId_fkey";

-- AlterTable
ALTER TABLE "Media" ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FeedbackTicketMedia" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackTicketMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackTicketMedia_ticketId_sortOrder_idx" ON "FeedbackTicketMedia"("ticketId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackTicketMedia_ticketId_mediaId_key" ON "FeedbackTicketMedia"("ticketId", "mediaId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTicketMedia" ADD CONSTRAINT "FeedbackTicketMedia_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FeedbackTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTicketMedia" ADD CONSTRAINT "FeedbackTicketMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
