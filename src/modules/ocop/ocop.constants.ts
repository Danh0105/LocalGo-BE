import {
  OcopCategory as PrismaOcopCategory,
  OcopRating as PrismaOcopRating,
} from '../../../generated/prisma';

export const OCOP_CATEGORIES = [
  'Thực phẩm',
  'Đồ uống',
  'Nông sản tươi',
  'Sản phẩm chế biến',
] as const;
export type OcopCategoryLabel = (typeof OCOP_CATEGORIES)[number];

export const OCOP_CATEGORY_TO_DB: Record<
  OcopCategoryLabel,
  PrismaOcopCategory
> = {
  'Thực phẩm': PrismaOcopCategory.THUC_PHAM,
  'Đồ uống': PrismaOcopCategory.DO_UONG,
  'Nông sản tươi': PrismaOcopCategory.NONG_SAN_TUOI,
  'Sản phẩm chế biến': PrismaOcopCategory.SAN_PHAM_CHE_BIEN,
};

export const OCOP_CATEGORY_FROM_DB: Record<
  PrismaOcopCategory,
  OcopCategoryLabel
> = {
  [PrismaOcopCategory.THUC_PHAM]: 'Thực phẩm',
  [PrismaOcopCategory.DO_UONG]: 'Đồ uống',
  [PrismaOcopCategory.NONG_SAN_TUOI]: 'Nông sản tươi',
  [PrismaOcopCategory.SAN_PHAM_CHE_BIEN]: 'Sản phẩm chế biến',
};

export const OCOP_RATINGS = [3, 4, 5] as const;
export type OcopRatingValue = (typeof OCOP_RATINGS)[number];

export const OCOP_RATING_TO_DB: Record<OcopRatingValue, PrismaOcopRating> = {
  3: PrismaOcopRating.THREE,
  4: PrismaOcopRating.FOUR,
  5: PrismaOcopRating.FIVE,
};

export const OCOP_RATING_FROM_DB: Record<PrismaOcopRating, OcopRatingValue> = {
  [PrismaOcopRating.THREE]: 3,
  [PrismaOcopRating.FOUR]: 4,
  [PrismaOcopRating.FIVE]: 5,
};
