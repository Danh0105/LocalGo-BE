-- Optional Google Maps link shown on every trade-post response.
ALTER TABLE "TradePost"
ADD COLUMN "googleMapsUrl" VARCHAR(2048);
