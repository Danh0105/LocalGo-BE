-- Add a moderation-only state for approved posts that must no longer be
-- publicly visible without deleting their data.
ALTER TYPE "TradePostStatus" ADD VALUE 'HIDDEN' AFTER 'PUBLISHED';
