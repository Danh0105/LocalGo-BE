import { FeedbackChannelCategory as PrismaFeedbackChannelCategory } from '../../../generated/prisma';

export const FEEDBACK_CHANNEL_CATEGORIES = [
  'Góp ý chung',
  'Phản ánh hạ tầng',
  'Dịch vụ công',
  'Du lịch',
  'Mini App',
] as const;
export type FeedbackChannelCategoryLabel =
  (typeof FEEDBACK_CHANNEL_CATEGORIES)[number];

export const FEEDBACK_CHANNEL_CATEGORY_TO_DB: Record<
  FeedbackChannelCategoryLabel,
  PrismaFeedbackChannelCategory
> = {
  'Góp ý chung': PrismaFeedbackChannelCategory.GOP_Y_CHUNG,
  'Phản ánh hạ tầng': PrismaFeedbackChannelCategory.PHAN_ANH_HA_TANG,
  'Dịch vụ công': PrismaFeedbackChannelCategory.DICH_VU_CONG,
  'Du lịch': PrismaFeedbackChannelCategory.DU_LICH,
  'Mini App': PrismaFeedbackChannelCategory.MINI_APP,
};

export const FEEDBACK_CHANNEL_CATEGORY_FROM_DB: Record<
  PrismaFeedbackChannelCategory,
  FeedbackChannelCategoryLabel
> = {
  [PrismaFeedbackChannelCategory.GOP_Y_CHUNG]: 'Góp ý chung',
  [PrismaFeedbackChannelCategory.PHAN_ANH_HA_TANG]: 'Phản ánh hạ tầng',
  [PrismaFeedbackChannelCategory.DICH_VU_CONG]: 'Dịch vụ công',
  [PrismaFeedbackChannelCategory.DU_LICH]: 'Du lịch',
  [PrismaFeedbackChannelCategory.MINI_APP]: 'Mini App',
};
