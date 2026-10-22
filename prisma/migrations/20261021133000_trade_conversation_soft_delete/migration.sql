ALTER TABLE "TradeConversation"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TradeConversation_deletedAt_idx"
ON "TradeConversation"("deletedAt");
