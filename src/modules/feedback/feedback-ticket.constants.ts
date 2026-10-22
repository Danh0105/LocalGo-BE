import { FeedbackTicketStatus as PrismaFeedbackTicketStatus } from '../../../generated/prisma';

/** Max images/videos a citizen can attach to one feedback ticket. */
export const MAX_FEEDBACK_ATTACHMENTS = 10;

/** Max images that can be attached to one conversation message. */
export const MAX_FEEDBACK_MESSAGE_ATTACHMENTS = 5;

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
