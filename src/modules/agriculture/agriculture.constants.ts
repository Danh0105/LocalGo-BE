import { AgricultureCategory as PrismaAgricultureCategory } from '../../../generated/prisma';

export const AGRICULTURE_CATEGORIES = [
  'Cây trồng chủ lực',
  'Chăn nuôi',
  'Thủy lợi',
  'Mô hình sản xuất',
] as const;
export type AgricultureCategoryLabel = (typeof AGRICULTURE_CATEGORIES)[number];

export const AGRICULTURE_CATEGORY_TO_DB: Record<
  AgricultureCategoryLabel,
  PrismaAgricultureCategory
> = {
  'Cây trồng chủ lực': PrismaAgricultureCategory.CAY_TRONG_CHU_LUC,
  'Chăn nuôi': PrismaAgricultureCategory.CHAN_NUOI,
  'Thủy lợi': PrismaAgricultureCategory.THUY_LOI,
  'Mô hình sản xuất': PrismaAgricultureCategory.MO_HINH_SAN_XUAT,
};

export const AGRICULTURE_CATEGORY_FROM_DB: Record<
  PrismaAgricultureCategory,
  AgricultureCategoryLabel
> = {
  [PrismaAgricultureCategory.CAY_TRONG_CHU_LUC]: 'Cây trồng chủ lực',
  [PrismaAgricultureCategory.CHAN_NUOI]: 'Chăn nuôi',
  [PrismaAgricultureCategory.THUY_LOI]: 'Thủy lợi',
  [PrismaAgricultureCategory.MO_HINH_SAN_XUAT]: 'Mô hình sản xuất',
};
