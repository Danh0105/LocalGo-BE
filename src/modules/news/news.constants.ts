import { NewsCategory as PrismaNewsCategory } from '../../../generated/prisma';

export const NEWS_CATEGORIES = [
  'Thông báo',
  'Hoạt động xã',
  'Du lịch',
  'Nông nghiệp',
  'Chuyển đổi số',
] as const;
export type NewsCategoryLabel = (typeof NEWS_CATEGORIES)[number];

export const NEWS_CATEGORY_TO_DB: Record<
  NewsCategoryLabel,
  PrismaNewsCategory
> = {
  'Thông báo': PrismaNewsCategory.THONG_BAO,
  'Hoạt động xã': PrismaNewsCategory.HOAT_DONG_XA,
  'Du lịch': PrismaNewsCategory.DU_LICH,
  'Nông nghiệp': PrismaNewsCategory.NONG_NGHIEP,
  'Chuyển đổi số': PrismaNewsCategory.CHUYEN_DOI_SO,
};

export const NEWS_CATEGORY_FROM_DB: Record<
  PrismaNewsCategory,
  NewsCategoryLabel
> = {
  [PrismaNewsCategory.THONG_BAO]: 'Thông báo',
  [PrismaNewsCategory.HOAT_DONG_XA]: 'Hoạt động xã',
  [PrismaNewsCategory.DU_LICH]: 'Du lịch',
  [PrismaNewsCategory.NONG_NGHIEP]: 'Nông nghiệp',
  [PrismaNewsCategory.CHUYEN_DOI_SO]: 'Chuyển đổi số',
};
