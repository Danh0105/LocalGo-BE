import { FestivalCategory as PrismaFestivalCategory } from '../../../generated/prisma';

export const FESTIVAL_CATEGORIES = [
  'Lễ truyền thống',
  'Văn hóa cộng đồng',
  'Thể thao - vui chơi',
  'Sự kiện nông sản',
] as const;
export type FestivalCategoryLabel = (typeof FESTIVAL_CATEGORIES)[number];

export const FESTIVAL_CATEGORY_TO_DB: Record<
  FestivalCategoryLabel,
  PrismaFestivalCategory
> = {
  'Lễ truyền thống': PrismaFestivalCategory.LE_TRUYEN_THONG,
  'Văn hóa cộng đồng': PrismaFestivalCategory.VAN_HOA_CONG_DONG,
  'Thể thao - vui chơi': PrismaFestivalCategory.THE_THAO_VUI_CHOI,
  'Sự kiện nông sản': PrismaFestivalCategory.SU_KIEN_NONG_SAN,
};

export const FESTIVAL_CATEGORY_FROM_DB: Record<
  PrismaFestivalCategory,
  FestivalCategoryLabel
> = {
  [PrismaFestivalCategory.LE_TRUYEN_THONG]: 'Lễ truyền thống',
  [PrismaFestivalCategory.VAN_HOA_CONG_DONG]: 'Văn hóa cộng đồng',
  [PrismaFestivalCategory.THE_THAO_VUI_CHOI]: 'Thể thao - vui chơi',
  [PrismaFestivalCategory.SU_KIEN_NONG_SAN]: 'Sự kiện nông sản',
};
