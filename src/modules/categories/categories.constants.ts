/**
 * Allowlist of content-domain values for Category.domain. Category is built
 * now as shared infra for the 14 read-only content modules that ship in a
 * later phase — none of them exist yet, so nothing references these values
 * today, but the allowlist is defined upfront so their DTOs validate
 * correctly without revisiting this module later.
 */
export const CATEGORY_DOMAINS = [
  'AGRICULTURE',
  'ATTRACTION',
  'TEMPLE',
  'HISTORICAL_SITE',
  'SPECIALTY',
  'CUISINE',
  'CRAFT_VILLAGE',
  'FESTIVAL',
  'EXPERIENCE_TOUR',
  'OCOP',
  'MAP_PLACE',
  'NEWS',
  'CONTACT',
] as const;

export type CategoryDomain = (typeof CATEGORY_DOMAINS)[number];
