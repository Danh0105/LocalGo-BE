-- Link Mini App authenticated feedback tickets to the submitting user.
-- Nullable by design: existing anonymous tickets remain lookup-only by
-- ticketCode + phone, and are not backfilled from phone numbers.
ALTER TABLE "FeedbackTicket" ADD COLUMN "submittedById" TEXT;

CREATE INDEX "FeedbackTicket_submittedById_createdAt_idx" ON "FeedbackTicket"("submittedById", "createdAt");

ALTER TABLE "FeedbackTicket"
  ADD CONSTRAINT "FeedbackTicket_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
