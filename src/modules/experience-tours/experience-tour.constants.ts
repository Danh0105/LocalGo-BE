import { ExperienceTourCategory as PrismaExperienceTourCategory } from '../../../generated/prisma';

export const EXPERIENCE_TOUR_CATEGORIES = [
  'Nửa ngày',
  'Một ngày',
  'Gia đình',
  'Học sinh',
  'Nông nghiệp',
] as const;
export type ExperienceTourCategoryLabel =
  (typeof EXPERIENCE_TOUR_CATEGORIES)[number];

export const EXPERIENCE_TOUR_CATEGORY_TO_DB: Record<
  ExperienceTourCategoryLabel,
  PrismaExperienceTourCategory
> = {
  'Nửa ngày': PrismaExperienceTourCategory.NUA_NGAY,
  'Một ngày': PrismaExperienceTourCategory.MOT_NGAY,
  'Gia đình': PrismaExperienceTourCategory.GIA_DINH,
  'Học sinh': PrismaExperienceTourCategory.HOC_SINH,
  'Nông nghiệp': PrismaExperienceTourCategory.NONG_NGHIEP,
};

export const EXPERIENCE_TOUR_CATEGORY_FROM_DB: Record<
  PrismaExperienceTourCategory,
  ExperienceTourCategoryLabel
> = {
  [PrismaExperienceTourCategory.NUA_NGAY]: 'Nửa ngày',
  [PrismaExperienceTourCategory.MOT_NGAY]: 'Một ngày',
  [PrismaExperienceTourCategory.GIA_DINH]: 'Gia đình',
  [PrismaExperienceTourCategory.HOC_SINH]: 'Học sinh',
  [PrismaExperienceTourCategory.NONG_NGHIEP]: 'Nông nghiệp',
};
