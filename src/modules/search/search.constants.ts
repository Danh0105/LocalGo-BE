export const SEARCH_RESOURCE_TYPES = [
  'ABOUT',
  'TEMPLE',
  'SPECIALTY',
  'HISTORICAL_SITE',
  'AGRICULTURE',
  'OCOP',
  'CRAFT_VILLAGE',
  'CUISINE',
  'FESTIVAL',
  'EXPERIENCE_TOUR',
  'FEEDBACK_CHANNEL',
  'MAP_PLACE',
  'CONTACT',
  'NEWS',
  'TRADE_POST',
] as const;

export type SearchResourceType = (typeof SEARCH_RESOURCE_TYPES)[number];

export const SEARCH_RESOURCE_LABELS: Record<SearchResourceType, string> = {
  ABOUT: 'Giới thiệu',
  TEMPLE: 'Đền, chùa, miếu',
  SPECIALTY: 'Đặc sản',
  HISTORICAL_SITE: 'Di tích lịch sử',
  AGRICULTURE: 'Nông nghiệp',
  OCOP: 'Sản phẩm OCOP',
  CRAFT_VILLAGE: 'Làng nghề',
  CUISINE: 'Ẩm thực',
  FESTIVAL: 'Lễ hội',
  EXPERIENCE_TOUR: 'Tour trải nghiệm',
  FEEDBACK_CHANNEL: 'Kênh phản hồi',
  MAP_PLACE: 'Địa điểm bản đồ',
  CONTACT: 'Liên hệ',
  NEWS: 'Tin tức',
  TRADE_POST: 'Giao thương',
};
