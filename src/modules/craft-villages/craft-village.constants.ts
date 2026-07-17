import { CraftVillageCategory as PrismaCraftVillageCategory } from '../../../generated/prisma';

export const CRAFT_VILLAGE_CATEGORIES = [
  'Thủ công truyền thống',
  'Chế biến nông sản',
  'Dịch vụ trải nghiệm',
  'Sản phẩm gia đình',
] as const;
export type CraftVillageCategoryLabel =
  (typeof CRAFT_VILLAGE_CATEGORIES)[number];

export const CRAFT_VILLAGE_CATEGORY_TO_DB: Record<
  CraftVillageCategoryLabel,
  PrismaCraftVillageCategory
> = {
  'Thủ công truyền thống': PrismaCraftVillageCategory.THU_CONG_TRUYEN_THONG,
  'Chế biến nông sản': PrismaCraftVillageCategory.CHE_BIEN_NONG_SAN,
  'Dịch vụ trải nghiệm': PrismaCraftVillageCategory.DICH_VU_TRAI_NGHIEM,
  'Sản phẩm gia đình': PrismaCraftVillageCategory.SAN_PHAM_GIA_DINH,
};

export const CRAFT_VILLAGE_CATEGORY_FROM_DB: Record<
  PrismaCraftVillageCategory,
  CraftVillageCategoryLabel
> = {
  [PrismaCraftVillageCategory.THU_CONG_TRUYEN_THONG]: 'Thủ công truyền thống',
  [PrismaCraftVillageCategory.CHE_BIEN_NONG_SAN]: 'Chế biến nông sản',
  [PrismaCraftVillageCategory.DICH_VU_TRAI_NGHIEM]: 'Dịch vụ trải nghiệm',
  [PrismaCraftVillageCategory.SAN_PHAM_GIA_DINH]: 'Sản phẩm gia đình',
};
