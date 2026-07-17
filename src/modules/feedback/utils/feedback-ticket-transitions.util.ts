import { FeedbackTicketStatus } from '../../../../generated/prisma';

/**
 * Legal status transitions for the feedback-ticket handling workflow.
 * CLOSED and RESOLVED never transition back to NEW/IN_PROGRESS (no
 * reopen), matching the "không cho reopen" rule from product.
 */
export const FEEDBACK_TICKET_TRANSITIONS: Record<
  FeedbackTicketStatus,
  FeedbackTicketStatus[]
> = {
  [FeedbackTicketStatus.NEW]: [
    FeedbackTicketStatus.IN_PROGRESS,
    FeedbackTicketStatus.RESOLVED,
    FeedbackTicketStatus.CLOSED,
  ],
  [FeedbackTicketStatus.IN_PROGRESS]: [
    FeedbackTicketStatus.RESOLVED,
    FeedbackTicketStatus.CLOSED,
  ],
  [FeedbackTicketStatus.RESOLVED]: [FeedbackTicketStatus.CLOSED],
  [FeedbackTicketStatus.CLOSED]: [],
};

export function isValidFeedbackTicketTransition(
  from: FeedbackTicketStatus,
  to: FeedbackTicketStatus,
): boolean {
  return FEEDBACK_TICKET_TRANSITIONS[from].includes(to);
}
