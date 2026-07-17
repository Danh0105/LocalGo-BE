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
