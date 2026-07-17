import { TradePostStatus } from '../../../../../generated/prisma';

/**
 * Legal status transitions for the trade-post moderation workflow.
 * PUBLISHED -> PENDING is the "editing a published post reverts it to
 * moderation" rule (triggered from TradePostService.update, not a
 * dedicated workflow endpoint). EXPIRED has no inbound transition here
 * because Phase 1 has no scheduled job flipping status on expiry —
 * expiry is enforced only as a public-visibility query filter (see
 * docs/assumptions.md).
 */
export const TRADE_POST_TRANSITIONS: Record<
  TradePostStatus,
  TradePostStatus[]
> = {
  [TradePostStatus.DRAFT]: [TradePostStatus.PENDING],
  [TradePostStatus.PENDING]: [
    TradePostStatus.PUBLISHED,
    TradePostStatus.REJECTED,
  ],
  [TradePostStatus.REJECTED]: [TradePostStatus.PENDING],
  [TradePostStatus.PUBLISHED]: [
    TradePostStatus.HIDDEN,
    TradePostStatus.ARCHIVED,
    TradePostStatus.PENDING,
  ],
  [TradePostStatus.HIDDEN]: [TradePostStatus.PUBLISHED],
  [TradePostStatus.EXPIRED]: [],
  [TradePostStatus.ARCHIVED]: [],
};

export function isValidTradePostTransition(
  from: TradePostStatus,
  to: TradePostStatus,
): boolean {
  return TRADE_POST_TRANSITIONS[from].includes(to);
}
