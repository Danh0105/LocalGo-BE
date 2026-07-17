import { ContactCategory as PrismaContactCategory } from '../../../generated/prisma';

export const CONTACT_CATEGORIES = [
  'Hành chính',
  'Khẩn cấp',
  'Du lịch',
  'Nông nghiệp',
  'Phản ánh',
] as const;
export type ContactCategoryLabel = (typeof CONTACT_CATEGORIES)[number];

export const CONTACT_CATEGORY_TO_DB: Record<
  ContactCategoryLabel,
  PrismaContactCategory
> = {
  'Hành chính': PrismaContactCategory.HANH_CHINH,
  'Khẩn cấp': PrismaContactCategory.KHAN_CAP,
  'Du lịch': PrismaContactCategory.DU_LICH,
  'Nông nghiệp': PrismaContactCategory.NONG_NGHIEP,
  'Phản ánh': PrismaContactCategory.PHAN_ANH,
};

export const CONTACT_CATEGORY_FROM_DB: Record<
  PrismaContactCategory,
  ContactCategoryLabel
> = {
  [PrismaContactCategory.HANH_CHINH]: 'Hành chính',
  [PrismaContactCategory.KHAN_CAP]: 'Khẩn cấp',
  [PrismaContactCategory.DU_LICH]: 'Du lịch',
  [PrismaContactCategory.NONG_NGHIEP]: 'Nông nghiệp',
  [PrismaContactCategory.PHAN_ANH]: 'Phản ánh',
};
