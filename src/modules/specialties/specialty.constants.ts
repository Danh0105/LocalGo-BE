import { SpecialtyCategory as PrismaSpecialtyCategory } from '../../../generated/prisma';

export const SPECIALTY_CATEGORIES = [
  'Món ăn',
  'Trái cây',
  'Quà mang về',
] as const;
export type SpecialtyCategoryLabel = (typeof SPECIALTY_CATEGORIES)[number];

export const SPECIALTY_CATEGORY_TO_DB: Record<
  SpecialtyCategoryLabel,
  PrismaSpecialtyCategory
> = {
  'Món ăn': PrismaSpecialtyCategory.MON_AN,
  'Trái cây': PrismaSpecialtyCategory.TRAI_CAY,
  'Quà mang về': PrismaSpecialtyCategory.QUA_MANG_VE,
};

export const SPECIALTY_CATEGORY_FROM_DB: Record<
  PrismaSpecialtyCategory,
  SpecialtyCategoryLabel
> = {
  [PrismaSpecialtyCategory.MON_AN]: 'Món ăn',
  [PrismaSpecialtyCategory.TRAI_CAY]: 'Trái cây',
  [PrismaSpecialtyCategory.QUA_MANG_VE]: 'Quà mang về',
};
