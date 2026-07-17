import { TempleType as PrismaTempleType } from '../../../generated/prisma';

export const TEMPLE_TYPES = ['Đình', 'Chùa', 'Miếu'] as const;
export type TempleTypeLabel = (typeof TEMPLE_TYPES)[number];

export const TEMPLE_TYPE_TO_DB: Record<TempleTypeLabel, PrismaTempleType> = {
  Đình: PrismaTempleType.DINH,
  Chùa: PrismaTempleType.CHUA,
  Miếu: PrismaTempleType.MIEU,
};

export const TEMPLE_TYPE_FROM_DB: Record<PrismaTempleType, TempleTypeLabel> = {
  [PrismaTempleType.DINH]: 'Đình',
  [PrismaTempleType.CHUA]: 'Chùa',
  [PrismaTempleType.MIEU]: 'Miếu',
};
