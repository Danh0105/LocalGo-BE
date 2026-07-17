import { TradePostStatus } from '../../../../../generated/prisma';
import { isValidTradePostTransition } from './trade-post-transitions.util';

const ALL_STATUSES = Object.values(TradePostStatus);

const LEGAL_PAIRS: [TradePostStatus, TradePostStatus][] = [
  [TradePostStatus.DRAFT, TradePostStatus.PENDING],
  [TradePostStatus.PENDING, TradePostStatus.PUBLISHED],
  [TradePostStatus.PENDING, TradePostStatus.REJECTED],
  [TradePostStatus.REJECTED, TradePostStatus.PENDING],
  [TradePostStatus.PUBLISHED, TradePostStatus.ARCHIVED],
  [TradePostStatus.PUBLISHED, TradePostStatus.PENDING],
  [TradePostStatus.PUBLISHED, TradePostStatus.HIDDEN],
  [TradePostStatus.HIDDEN, TradePostStatus.PUBLISHED],
];

describe('isValidTradePostTransition', () => {
  it.each(LEGAL_PAIRS)('allows %s -> %s', (from, to) => {
    expect(isValidTradePostTransition(from, to)).toBe(true);
  });

  it('rejects every pair not explicitly whitelisted', () => {
    const legalSet = new Set(LEGAL_PAIRS.map(([from, to]) => `${from}->${to}`));
    const illegalPairs: string[] = [];

    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const key = `${from}->${to}`;
        if (!legalSet.has(key)) {
          if (isValidTradePostTransition(from, to)) {
            illegalPairs.push(key);
          }
        }
      }
    }

    expect(illegalPairs).toEqual([]);
  });

  it('never allows a status to transition to itself', () => {
    for (const status of ALL_STATUSES) {
      expect(isValidTradePostTransition(status, status)).toBe(false);
    }
  });

  it('ARCHIVED and EXPIRED are terminal in Phase 1 (no outbound transitions)', () => {
    for (const to of ALL_STATUSES) {
      expect(isValidTradePostTransition(TradePostStatus.ARCHIVED, to)).toBe(
        false,
      );
      expect(isValidTradePostTransition(TradePostStatus.EXPIRED, to)).toBe(
        false,
      );
    }
  });
});
