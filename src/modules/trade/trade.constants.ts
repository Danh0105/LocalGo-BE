export const MAX_TRADE_POST_IMAGES = 10;
export const MAX_TRADE_REVIEW_IMAGES = 3;

export const TRADE_POST_SORT_OPTIONS = [
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'popular',
] as const;
export type TradePostSortOption = (typeof TRADE_POST_SORT_OPTIONS)[number];

/**
 * Interaction event types a visitor can explicitly report via the public
 * interactions endpoint. VIEW is recorded implicitly on detail fetch and SAVE
 * flows through the favorites endpoint, so neither is accepted here.
 */
export const TRADE_POST_INTERACTION_TYPES = [
  'CONTACT_PHONE',
  'CONTACT_ZALO',
  'SHARE',
] as const;
export type TradePostInteractionType =
  (typeof TRADE_POST_INTERACTION_TYPES)[number];

/** Default analytics look-back window (days) when no date range is provided. */
export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;
/** Number of most-viewed posts returned in analytics summaries. */
export const ANALYTICS_TOP_POSTS_LIMIT = 5;
