import { ContentReviewTargetType } from '../../../generated/prisma';

export const MAX_CONTENT_REVIEW_IMAGES = 3;
export const MAX_CONTENT_REVIEW_RATING_IDS = 100;

/**
 * API names of the reviewable sections — the same path segment as each
 * section's public route (`/temples/:id` -> `temples`), so the mini app can go
 * from a review back to its item without another lookup table.
 */
export const CONTENT_REVIEW_TARGET_TYPES = [
  'temples',
  'specialties',
  'historical-sites',
  'agriculture',
  'craft-villages',
  'cuisine',
  'festivals',
  'experience-tours',
] as const;
export type ContentReviewTargetTypeName =
  (typeof CONTENT_REVIEW_TARGET_TYPES)[number];

export const CONTENT_REVIEW_TARGET_TO_DB: Record<
  ContentReviewTargetTypeName,
  ContentReviewTargetType
> = {
  temples: ContentReviewTargetType.TEMPLE,
  specialties: ContentReviewTargetType.SPECIALTY,
  'historical-sites': ContentReviewTargetType.HISTORICAL_SITE,
  agriculture: ContentReviewTargetType.AGRICULTURE,
  'craft-villages': ContentReviewTargetType.CRAFT_VILLAGE,
  cuisine: ContentReviewTargetType.CUISINE,
  festivals: ContentReviewTargetType.FESTIVAL,
  'experience-tours': ContentReviewTargetType.EXPERIENCE_TOUR,
};

export const CONTENT_REVIEW_TARGET_FROM_DB: Record<
  ContentReviewTargetType,
  ContentReviewTargetTypeName
> = {
  [ContentReviewTargetType.TEMPLE]: 'temples',
  [ContentReviewTargetType.SPECIALTY]: 'specialties',
  [ContentReviewTargetType.HISTORICAL_SITE]: 'historical-sites',
  [ContentReviewTargetType.AGRICULTURE]: 'agriculture',
  [ContentReviewTargetType.CRAFT_VILLAGE]: 'craft-villages',
  [ContentReviewTargetType.CUISINE]: 'cuisine',
  [ContentReviewTargetType.FESTIVAL]: 'festivals',
  [ContentReviewTargetType.EXPERIENCE_TOUR]: 'experience-tours',
};

export const CONTENT_REVIEW_TARGET_LABELS: Record<
  ContentReviewTargetType,
  string
> = {
  [ContentReviewTargetType.TEMPLE]: 'Đền - Chùa - Miếu',
  [ContentReviewTargetType.SPECIALTY]: 'Đặc sản',
  [ContentReviewTargetType.HISTORICAL_SITE]: 'Di tích lịch sử',
  [ContentReviewTargetType.AGRICULTURE]: 'Nông nghiệp',
  [ContentReviewTargetType.CRAFT_VILLAGE]: 'Làng nghề',
  [ContentReviewTargetType.CUISINE]: 'Ẩm thực',
  [ContentReviewTargetType.FESTIVAL]: 'Lễ hội',
  [ContentReviewTargetType.EXPERIENCE_TOUR]: 'Tour trải nghiệm',
};

export function isContentReviewTargetTypeName(
  value: unknown,
): value is ContentReviewTargetTypeName {
  return (
    typeof value === 'string' &&
    (CONTENT_REVIEW_TARGET_TYPES as readonly string[]).includes(value)
  );
}
