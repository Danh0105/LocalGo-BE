CREATE TABLE "SpecialtyImage" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialtyImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HistoricalSiteImage" (
    "id" TEXT NOT NULL,
    "historicalSiteId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricalSiteImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgricultureItemImage" (
    "id" TEXT NOT NULL,
    "agricultureItemId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgricultureItemImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CraftVillageImage" (
    "id" TEXT NOT NULL,
    "craftVillageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CraftVillageImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FestivalImage" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperienceTourImage" (
    "id" TEXT NOT NULL,
    "experienceTourId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperienceTourImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactImage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsArticleImage" (
    "id" TEXT NOT NULL,
    "newsArticleId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsArticleImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialtyImage_specialtyId_mediaId_key" ON "SpecialtyImage"("specialtyId", "mediaId");
CREATE INDEX "SpecialtyImage_specialtyId_sortOrder_idx" ON "SpecialtyImage"("specialtyId", "sortOrder");
CREATE UNIQUE INDEX "HistoricalSiteImage_historicalSiteId_mediaId_key" ON "HistoricalSiteImage"("historicalSiteId", "mediaId");
CREATE INDEX "HistoricalSiteImage_historicalSiteId_sortOrder_idx" ON "HistoricalSiteImage"("historicalSiteId", "sortOrder");
CREATE UNIQUE INDEX "AgricultureItemImage_agricultureItemId_mediaId_key" ON "AgricultureItemImage"("agricultureItemId", "mediaId");
CREATE INDEX "AgricultureItemImage_agricultureItemId_sortOrder_idx" ON "AgricultureItemImage"("agricultureItemId", "sortOrder");
CREATE UNIQUE INDEX "CraftVillageImage_craftVillageId_mediaId_key" ON "CraftVillageImage"("craftVillageId", "mediaId");
CREATE INDEX "CraftVillageImage_craftVillageId_sortOrder_idx" ON "CraftVillageImage"("craftVillageId", "sortOrder");
CREATE UNIQUE INDEX "FestivalImage_festivalId_mediaId_key" ON "FestivalImage"("festivalId", "mediaId");
CREATE INDEX "FestivalImage_festivalId_sortOrder_idx" ON "FestivalImage"("festivalId", "sortOrder");
CREATE UNIQUE INDEX "ExperienceTourImage_experienceTourId_mediaId_key" ON "ExperienceTourImage"("experienceTourId", "mediaId");
CREATE INDEX "ExperienceTourImage_experienceTourId_sortOrder_idx" ON "ExperienceTourImage"("experienceTourId", "sortOrder");
CREATE UNIQUE INDEX "ContactImage_contactId_mediaId_key" ON "ContactImage"("contactId", "mediaId");
CREATE INDEX "ContactImage_contactId_sortOrder_idx" ON "ContactImage"("contactId", "sortOrder");
CREATE UNIQUE INDEX "NewsArticleImage_newsArticleId_mediaId_key" ON "NewsArticleImage"("newsArticleId", "mediaId");
CREATE INDEX "NewsArticleImage_newsArticleId_sortOrder_idx" ON "NewsArticleImage"("newsArticleId", "sortOrder");

ALTER TABLE "SpecialtyImage" ADD CONSTRAINT "SpecialtyImage_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialtyImage" ADD CONSTRAINT "SpecialtyImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricalSiteImage" ADD CONSTRAINT "HistoricalSiteImage_historicalSiteId_fkey" FOREIGN KEY ("historicalSiteId") REFERENCES "HistoricalSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricalSiteImage" ADD CONSTRAINT "HistoricalSiteImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgricultureItemImage" ADD CONSTRAINT "AgricultureItemImage_agricultureItemId_fkey" FOREIGN KEY ("agricultureItemId") REFERENCES "AgricultureItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgricultureItemImage" ADD CONSTRAINT "AgricultureItemImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CraftVillageImage" ADD CONSTRAINT "CraftVillageImage_craftVillageId_fkey" FOREIGN KEY ("craftVillageId") REFERENCES "CraftVillage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CraftVillageImage" ADD CONSTRAINT "CraftVillageImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FestivalImage" ADD CONSTRAINT "FestivalImage_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FestivalImage" ADD CONSTRAINT "FestivalImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperienceTourImage" ADD CONSTRAINT "ExperienceTourImage_experienceTourId_fkey" FOREIGN KEY ("experienceTourId") REFERENCES "ExperienceTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperienceTourImage" ADD CONSTRAINT "ExperienceTourImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactImage" ADD CONSTRAINT "ContactImage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactImage" ADD CONSTRAINT "ContactImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsArticleImage" ADD CONSTRAINT "NewsArticleImage_newsArticleId_fkey" FOREIGN KEY ("newsArticleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsArticleImage" ADD CONSTRAINT "NewsArticleImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
