import { BusinessType, TradePostPurpose } from '../../../generated/prisma';

export const MAX_TRADE_POST_IMAGES = 10;
export const MAX_TRADE_REVIEW_IMAGES = 3;

/**
 * Mini app content sections that also show trade posts (GET
 * /trade-posts?section=), named like each section's public route. A post
 * belongs to a section through its owner's User.businessType.
 */
export const TRADE_POST_SECTIONS = [
  'temples',
  'specialties',
  'agriculture',
  'cuisine',
] as const;
export type TradePostSection = (typeof TRADE_POST_SECTIONS)[number];

export const TRADE_POST_SECTION_BUSINESS_TYPES: Record<
  TradePostSection,
  BusinessType[]
> = {
  temples: [BusinessType.TEMPLE_MANAGEMENT],
  specialties: [BusinessType.GARDEN],
  agriculture: [BusinessType.GARDEN],
  cuisine: [BusinessType.RESTAURANT],
};

/**
 * Extra purpose restrictions for a section. Temple management accounts are
 * already prevented from creating commercial posts, but this filter also
 * keeps invalid legacy/imported data out of the temple tourism screen.
 */
export const TRADE_POST_SECTION_PURPOSES: Partial<
  Record<TradePostSection, TradePostPurpose[]>
> = {
  temples: [TradePostPurpose.NON_PROFIT],
};

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
