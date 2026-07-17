import { MapPlaceCategory as PrismaMapPlaceCategory } from '../../../generated/prisma';

export const MAP_PLACE_CATEGORIES = [
  'Hành chính',
  'Du lịch',
  'Di tích',
  'Ẩm thực',
  'Dịch vụ',
] as const;
export type MapPlaceCategoryLabel = (typeof MAP_PLACE_CATEGORIES)[number];

export const MAP_PLACE_CATEGORY_TO_DB: Record<
  MapPlaceCategoryLabel,
  PrismaMapPlaceCategory
> = {
  'Hành chính': PrismaMapPlaceCategory.HANH_CHINH,
  'Du lịch': PrismaMapPlaceCategory.DU_LICH,
  'Di tích': PrismaMapPlaceCategory.DI_TICH,
  'Ẩm thực': PrismaMapPlaceCategory.AM_THUC,
  'Dịch vụ': PrismaMapPlaceCategory.DICH_VU,
};

export const MAP_PLACE_CATEGORY_FROM_DB: Record<
  PrismaMapPlaceCategory,
  MapPlaceCategoryLabel
> = {
  [PrismaMapPlaceCategory.HANH_CHINH]: 'Hành chính',
  [PrismaMapPlaceCategory.DU_LICH]: 'Du lịch',
  [PrismaMapPlaceCategory.DI_TICH]: 'Di tích',
  [PrismaMapPlaceCategory.AM_THUC]: 'Ẩm thực',
  [PrismaMapPlaceCategory.DICH_VU]: 'Dịch vụ',
};
