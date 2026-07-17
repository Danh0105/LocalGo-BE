import { CuisineCategory as PrismaCuisineCategory } from '../../../generated/prisma';

export const CUISINE_CATEGORIES = [
  'Món nước',
  'Món nướng',
  'Món cuốn',
  'Ăn vặt',
  'Món chay',
] as const;
export type CuisineCategoryLabel = (typeof CUISINE_CATEGORIES)[number];

export const CUISINE_CATEGORY_TO_DB: Record<
  CuisineCategoryLabel,
  PrismaCuisineCategory
> = {
  'Món nước': PrismaCuisineCategory.MON_NUOC,
  'Món nướng': PrismaCuisineCategory.MON_NUONG,
  'Món cuốn': PrismaCuisineCategory.MON_CUON,
  'Ăn vặt': PrismaCuisineCategory.AN_VAT,
  'Món chay': PrismaCuisineCategory.MON_CHAY,
};

export const CUISINE_CATEGORY_FROM_DB: Record<
  PrismaCuisineCategory,
  CuisineCategoryLabel
> = {
  [PrismaCuisineCategory.MON_NUOC]: 'Món nước',
  [PrismaCuisineCategory.MON_NUONG]: 'Món nướng',
  [PrismaCuisineCategory.MON_CUON]: 'Món cuốn',
  [PrismaCuisineCategory.AN_VAT]: 'Ăn vặt',
  [PrismaCuisineCategory.MON_CHAY]: 'Món chay',
};
