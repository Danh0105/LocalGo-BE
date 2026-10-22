CREATE TABLE "FeedbackTicketReadState" (
    "id" SERIAL NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reader" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackTicketReadState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackTicketReadState_ticketId_idx"
ON "FeedbackTicketReadState"("ticketId");

CREATE UNIQUE INDEX "FeedbackTicketReadState_ticketId_reader_key"
ON "FeedbackTicketReadState"("ticketId", "reader");

ALTER TABLE "FeedbackTicketReadState"
ADD CONSTRAINT "FeedbackTicketReadState_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "FeedbackTicket"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
