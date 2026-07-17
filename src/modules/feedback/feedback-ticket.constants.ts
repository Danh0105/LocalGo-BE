import { FeedbackTicketStatus as PrismaFeedbackTicketStatus } from '../../../generated/prisma';

export const FEEDBACK_TICKET_STATUSES = [
  'new',
  'in_progress',
  'resolved',
  'closed',
] as const;
export type FeedbackTicketStatusLabel =
  (typeof FEEDBACK_TICKET_STATUSES)[number];

export const FEEDBACK_TICKET_STATUS_TO_DB: Record<
  FeedbackTicketStatusLabel,
  PrismaFeedbackTicketStatus
> = {
  new: PrismaFeedbackTicketStatus.NEW,
  in_progress: PrismaFeedbackTicketStatus.IN_PROGRESS,
  resolved: PrismaFeedbackTicketStatus.RESOLVED,
  closed: PrismaFeedbackTicketStatus.CLOSED,
};

export const FEEDBACK_TICKET_STATUS_FROM_DB: Record<
  PrismaFeedbackTicketStatus,
  FeedbackTicketStatusLabel
> = {
  [PrismaFeedbackTicketStatus.NEW]: 'new',
  [PrismaFeedbackTicketStatus.IN_PROGRESS]: 'in_progress',
  [PrismaFeedbackTicketStatus.RESOLVED]: 'resolved',
  [PrismaFeedbackTicketStatus.CLOSED]: 'closed',
};
