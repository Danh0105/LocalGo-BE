-- Public customer replies below a trade-post owner's review response.

CREATE TABLE "TradeReviewCustomerReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeReviewCustomerReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeReviewCustomerReply_reviewId_createdAt_id_idx"
ON "TradeReviewCustomerReply"("reviewId", "createdAt", "id");

CREATE INDEX "TradeReviewCustomerReply_userId_idx"
ON "TradeReviewCustomerReply"("userId");

ALTER TABLE "TradeReviewCustomerReply"
ADD CONSTRAINT "TradeReviewCustomerReply_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "TradeReview"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeReviewCustomerReply"
ADD CONSTRAINT "TradeReviewCustomerReply_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
