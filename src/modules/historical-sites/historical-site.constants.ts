import { HistoricalSiteRank as PrismaHistoricalSiteRank } from '../../../generated/prisma';

export const HISTORICAL_SITE_RANKS = [
  'Cấp quốc gia',
  'Cấp tỉnh',
  'Chưa xếp hạng',
] as const;
export type HistoricalSiteRankLabel = (typeof HISTORICAL_SITE_RANKS)[number];

export const HISTORICAL_SITE_RANK_TO_DB: Record<
  HistoricalSiteRankLabel,
  PrismaHistoricalSiteRank
> = {
  'Cấp quốc gia': PrismaHistoricalSiteRank.CAP_QUOC_GIA,
  'Cấp tỉnh': PrismaHistoricalSiteRank.CAP_TINH,
  'Chưa xếp hạng': PrismaHistoricalSiteRank.CHUA_XEP_HANG,
};

export const HISTORICAL_SITE_RANK_FROM_DB: Record<
  PrismaHistoricalSiteRank,
  HistoricalSiteRankLabel
> = {
  [PrismaHistoricalSiteRank.CAP_QUOC_GIA]: 'Cấp quốc gia',
  [PrismaHistoricalSiteRank.CAP_TINH]: 'Cấp tỉnh',
  [PrismaHistoricalSiteRank.CHUA_XEP_HANG]: 'Chưa xếp hạng',
};
