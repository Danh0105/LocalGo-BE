-- PostgreSQL-backed global full-text search.
-- `unaccent` makes Vietnamese queries accent-insensitive and `pg_trgm`
-- provides a conservative typo fallback for titles.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION localgo_normalize_search_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT trim(
    regexp_replace(
      replace(lower(public.unaccent(input)), 'đ', 'd'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION localgo_prefix_tsquery(input text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT to_tsquery(
    'simple',
    string_agg(quote_literal(term) || ':*', ' & ')
  )
  FROM unnest(
    regexp_split_to_array(localgo_normalize_search_text(input), '\\s+')
  ) AS term
  WHERE term <> '';
$$;

CREATE VIEW "GlobalSearchDocument" AS
SELECT
  source.*,
  localgo_normalize_search_text(source.title) AS normalized_title,
  localgo_normalize_search_text(source.search_text) AS normalized_search_text,
  setweight(
    to_tsvector('simple', localgo_normalize_search_text(source.title)),
    'A'
  ) ||
  setweight(
    to_tsvector('simple', localgo_normalize_search_text(source.summary)),
    'B'
  ) ||
  setweight(
    to_tsvector('simple', localgo_normalize_search_text(source.search_text)),
    'C'
  ) AS search_vector
FROM (
  SELECT
    'ABOUT'::text AS resource_type,
    'Giới thiệu'::text AS resource_label,
    page.id,
    page.id AS slug,
    COALESCE(page."publishedSnapshot" ->> 'title', 'Giới thiệu') AS title,
    left(COALESCE(page."publishedSnapshot" #>> '{overview,paragraphs}', ''), 300) AS summary,
    NULL::text AS category,
    COALESCE(media."thumbnailUrl", media."originalUrl") AS image_url,
    'PUBLISHED'::text AS status,
    page."updatedAt" AS updated_at,
    'PUBLIC'::text AS audience,
    true AS is_public,
    concat_ws(' ', page.id, page."publishedSnapshot"::text) AS search_text
  FROM "AboutPage" page
  LEFT JOIN "Media" media
    ON media.id = page."publishedSnapshot" #>> '{hero,mediaId}'
    AND media."deletedAt" IS NULL
  WHERE page."publishedSnapshot" IS NOT NULL

  UNION ALL

  SELECT
    'ABOUT',
    'Giới thiệu',
    page.id,
    page.id,
    COALESCE(page."draftSnapshot" ->> 'title', 'Giới thiệu'),
    left(COALESCE(page."draftSnapshot" #>> '{overview,paragraphs}', ''), 300),
    NULL::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE
      WHEN page.version = page."publishedVersion" THEN 'PUBLISHED'
      ELSE 'DRAFT'
    END,
    page."updatedAt",
    'ADMIN',
    false,
    concat_ws(' ', page.id, page."draftSnapshot"::text)
  FROM "AboutPage" page
  LEFT JOIN "Media" media
    ON media.id = page."draftSnapshot" #>> '{hero,mediaId}'
    AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'TEMPLE', 'Đền, chùa, miếu', item.id, item.id, item.name,
    item.summary, item.type::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.type::text,
      item.address, item."openHours", item.description::text,
      COALESCE(events.search_text, ''))
  FROM "Temple" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', event.name, event.time), ' ') AS search_text
    FROM "TempleEvent" event WHERE event."templeId" = item.id
  ) events ON true

  UNION ALL

  SELECT
    'SPECIALTY', 'Đặc sản', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.price, item.season, item.description::text, item."buyPlaces"::text)
  FROM "Specialty" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL
  WHERE item."deletedAt" IS NULL

  UNION ALL

  SELECT
    'HISTORICAL_SITE', 'Di tích lịch sử', item.id, item.id, item.name,
    item.summary, item.rank::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.rank::text,
      item.address, item."recognizedYear"::text, item.history::text,
      item.highlights::text)
  FROM "HistoricalSite" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'AGRICULTURE', 'Nông nghiệp', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.location, item.season, item.scale, item.description::text,
      item.highlights::text, item.support)
  FROM "AgricultureItem" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'OCOP', 'Sản phẩm OCOP', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.rating::text, item.producer, item.address, item."priceRange",
      item.description::text, item.highlights::text, item."contactNote")
  FROM "OcopProduct" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'CRAFT_VILLAGE', 'Làng nghề', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.address, item."workingTime", item."mainProducts",
      item.description::text, item.highlights::text, item."visitorNote")
  FROM "CraftVillage" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'CUISINE', 'Ẩm thực', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item."priceRange", item."bestTime", item."suggestedPlaces"::text,
      item.description::text, item.highlights::text, item.tip, item.menu::text)
  FROM "CuisineItem" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'FESTIVAL', 'Lễ hội', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.time, item.location, item.scale, item.description::text,
      item.activities::text, item.note)
  FROM "Festival" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'EXPERIENCE_TOUR', 'Tour trải nghiệm', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.duration, item."startTime", item."priceRange", item."meetingPoint",
      item.description::text, item.itinerary::text, item.included::text, item.note)
  FROM "ExperienceTour" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'FEEDBACK_CHANNEL', 'Kênh phản hồi', item.id, item.id, item.title,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.title, item.summary, item.category::text,
      item."responseTime", item."requiredInfo"::text, item.description::text,
      item.examples::text, item.note)
  FROM "FeedbackChannel" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'MAP_PLACE', 'Địa điểm bản đồ', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.address, item."openTime", item."distanceFromCenter",
      item.description::text, item.highlights::text, item."directionNote")
  FROM "MapPlace" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'CONTACT', 'Liên hệ', item.id, item.id, item.name,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE WHEN item."isActive" THEN 'ACTIVE' ELSE 'HIDDEN' END,
    item."updatedAt", 'BOTH', item."isActive",
    concat_ws(' ', item.id, item.name, item.summary, item.category::text,
      item.role, item.phone, item.email, item.address, item."workingTime",
      item.description::text, item."supportTopics"::text, item.note)
  FROM "Contact" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'NEWS', 'Tin tức', item.id, item.id, item.title,
    item.summary, item.category::text,
    COALESCE(media."thumbnailUrl", media."originalUrl"),
    CASE
      WHEN NOT item."isActive" THEN 'HIDDEN'
      WHEN item."publishedAt" > CURRENT_TIMESTAMP THEN 'SCHEDULED'
      ELSE 'PUBLISHED'
    END,
    item."updatedAt", 'BOTH',
    item."isActive" AND item."publishedAt" <= CURRENT_TIMESTAMP,
    concat_ws(' ', item.id, item.title, item.summary, item.category::text,
      item.author, item.content::text, item.tags::text, item."relatedLinks"::text)
  FROM "NewsArticle" item
  LEFT JOIN "Media" media ON media.id = item."mediaId" AND media."deletedAt" IS NULL

  UNION ALL

  SELECT
    'TRADE_POST', 'Giao thương', item.id, item.slug, item.title,
    item.summary, category.code,
    item."thumbnailUrl", item.status::text,
    item."updatedAt", 'BOTH',
    item.status = 'PUBLISHED'
      AND category."isActive"
      AND category."deletedAt" IS NULL
      AND (
        item."expiresAt" > CURRENT_TIMESTAMP
        OR (
          item."expiresAt" IS NULL
          AND (item."eventEndAt" IS NULL OR item."eventEndAt" > CURRENT_TIMESTAMP)
        )
      ),
    concat_ws(' ', item.id, item.slug, item.title, item.summary,
      category.code, category.name, item.description, item.address,
      item."contactName", item."priceLabel", item.purpose::text)
  FROM "TradePost" item
  JOIN "TradePostCategory" category ON category.id = item."categoryId"
  WHERE item."deletedAt" IS NULL
) source;

-- Trigram indexes accelerate typo/prefix candidate selection on titles. The
-- full-text vector itself is evaluated by PostgreSQL in the view, keeping the
-- index always current without an application-managed reindex job.
CREATE INDEX "Temple_name_search_trgm_idx"
  ON "Temple" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "Specialty_name_search_trgm_idx"
  ON "Specialty" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "HistoricalSite_name_search_trgm_idx"
  ON "HistoricalSite" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "AgricultureItem_name_search_trgm_idx"
  ON "AgricultureItem" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "OcopProduct_name_search_trgm_idx"
  ON "OcopProduct" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "CraftVillage_name_search_trgm_idx"
  ON "CraftVillage" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "CuisineItem_name_search_trgm_idx"
  ON "CuisineItem" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "Festival_name_search_trgm_idx"
  ON "Festival" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "ExperienceTour_name_search_trgm_idx"
  ON "ExperienceTour" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "FeedbackChannel_title_search_trgm_idx"
  ON "FeedbackChannel" USING gin (localgo_normalize_search_text(title) gin_trgm_ops);
CREATE INDEX "MapPlace_name_search_trgm_idx"
  ON "MapPlace" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "Contact_name_search_trgm_idx"
  ON "Contact" USING gin (localgo_normalize_search_text(name) gin_trgm_ops);
CREATE INDEX "NewsArticle_title_search_trgm_idx"
  ON "NewsArticle" USING gin (localgo_normalize_search_text(title) gin_trgm_ops);
CREATE INDEX "TradePost_title_search_trgm_idx"
  ON "TradePost" USING gin (localgo_normalize_search_text(title) gin_trgm_ops);
