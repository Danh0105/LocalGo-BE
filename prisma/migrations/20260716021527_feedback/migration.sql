-- CreateEnum
CREATE TYPE "FeedbackChannelCategory" AS ENUM ('GOP_Y_CHUNG', 'PHAN_ANH_HA_TANG', 'DICH_VU_CONG', 'DU_LICH', 'MINI_APP');

-- CreateEnum
CREATE TYPE "FeedbackTicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterEnum
ALTER TYPE "MediaResourceType" ADD VALUE 'FEEDBACK_CHANNEL';

-- CreateTable
CREATE TABLE "FeedbackChannel" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "FeedbackChannelCategory" NOT NULL,
    "responseTime" VARCHAR(150) NOT NULL,
    "requiredInfo" JSONB NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "note" VARCHAR(2000) NOT NULL,
    "mediaId" TEXT,
    "imageAlt" VARCHAR(150) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackTicket" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "channelId" TEXT,
    "fullName" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "content" VARCHAR(5000) NOT NULL,
    "status" "FeedbackTicketStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" VARCHAR(2000),
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FeedbackTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackChannel_isActive_sortOrder_createdAt_idx" ON "FeedbackChannel"("isActive", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackChannel_category_isActive_sortOrder_idx" ON "FeedbackChannel"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FeedbackChannel_title_idx" ON "FeedbackChannel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackTicket_ticketCode_key" ON "FeedbackTicket"("ticketCode");

-- CreateIndex
CREATE INDEX "FeedbackTicket_status_createdAt_idx" ON "FeedbackTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackTicket_channelId_idx" ON "FeedbackTicket"("channelId");

-- CreateIndex
CREATE INDEX "FeedbackTicket_phone_idx" ON "FeedbackTicket"("phone");

-- AddForeignKey
ALTER TABLE "FeedbackChannel" ADD CONSTRAINT "FeedbackChannel_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackChannel" ADD CONSTRAINT "FeedbackChannel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackChannel" ADD CONSTRAINT "FeedbackChannel_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTicket" ADD CONSTRAINT "FeedbackTicket_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "FeedbackChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTicket" ADD CONSTRAINT "FeedbackTicket_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
