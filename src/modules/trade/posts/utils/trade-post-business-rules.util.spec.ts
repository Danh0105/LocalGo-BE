import {
  TradePostPriceType,
  TradePostPurpose,
} from '../../../../../generated/prisma';
import { AppException } from '../../../../common/exceptions/app.exception';
import {
  assertEventEndInFuture,
  assertExpiresAtInFuture,
  assertValidTradePostState,
  effectiveExpiry,
} from './trade-post-business-rules.util';

describe('assertValidTradePostState', () => {
  it('rejects FIXED price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.FIXED,
        price: null,
      }),
    ).toThrow(AppException);
  });

  it('rejects FIXED price type with a zero price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.FIXED,
        price: 0,
      }),
    ).toThrow(AppException);
  });

  it('accepts FIXED price type with a positive price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.FIXED,
        price: 150000,
      }),
    ).not.toThrow();
  });

  it('accepts NEGOTIABLE price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.NEGOTIABLE,
        price: null,
      }),
    ).not.toThrow();
  });

  it('accepts CONTACT price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'SERVICE',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.CONTACT,
        price: null,
      }),
    ).not.toThrow();
  });

  it('rejects PROMOTION category missing promotion fields', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PROMOTION',
        requiresPromotionDetails: true,
        priceType: TradePostPriceType.CONTACT,
      }),
    ).toThrow(AppException);
  });

  it('accepts PROMOTION category with all promotion fields and a valid date range', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PROMOTION',
        requiresPromotionDetails: true,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 20,
        promotionStartAt: '2026-08-01T00:00:00.000Z',
        promotionEndAt: '2026-08-31T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects non-PROMOTION category carrying promotion fields', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 10,
      }),
    ).toThrow(AppException);
  });

  it('rejects promotionStartAt >= promotionEndAt', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PROMOTION',
        requiresPromotionDetails: true,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 15,
        promotionStartAt: '2026-08-31T00:00:00.000Z',
        promotionEndAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toThrow(AppException);
  });

  it('rejects promotionStartAt equal to promotionEndAt', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PROMOTION',
        requiresPromotionDetails: true,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 15,
        promotionStartAt: '2026-08-01T00:00:00.000Z',
        promotionEndAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toThrow(AppException);
  });
});

describe('assertExpiresAtInFuture', () => {
  const now = new Date('2026-10-19T01:38:04.000Z');

  it('accepts a missing expiry (no expiration)', () => {
    expect(() => assertExpiresAtInFuture(undefined, now)).not.toThrow();
    expect(() => assertExpiresAtInFuture(null, now)).not.toThrow();
  });

  it('accepts an expiry in the future', () => {
    expect(() =>
      assertExpiresAtInFuture('2026-10-26T01:38:04.000Z', now),
    ).not.toThrow();
  });

  it('rejects an expiry earlier than now (picker defaulted to "now")', () => {
    expect(() =>
      assertExpiresAtInFuture('2026-10-19T01:37:00.000Z', now),
    ).toThrow(AppException);
  });

  it('rejects an expiry equal to now', () => {
    expect(() => assertExpiresAtInFuture(now, now)).toThrow(AppException);
  });
});

describe('non-profit posts', () => {
  it('requires a price type for commercial posts', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PRODUCT',
        requiresPromotionDetails: false,
        purpose: TradePostPurpose.COMMERCIAL,
        priceType: null,
      }),
    ).toThrow(AppException);
  });

  it('accepts a non-profit post without any price', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'EVENT',
        requiresPromotionDetails: false,
        purpose: TradePostPurpose.NON_PROFIT,
        priceType: null,
        price: null,
      }),
    ).not.toThrow();
  });

  it('rejects a non-profit post in a promotion category', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'PROMOTION',
        requiresPromotionDetails: true,
        purpose: TradePostPurpose.NON_PROFIT,
        promotionPercent: 10,
        promotionStartAt: '2026-11-01T00:00:00.000Z',
        promotionEndAt: '2026-11-30T00:00:00.000Z',
      }),
    ).toThrow(AppException);
  });

  it('rejects an event that ends before it starts', () => {
    expect(() =>
      assertValidTradePostState({
        categoryCode: 'EVENT',
        requiresPromotionDetails: false,
        purpose: TradePostPurpose.NON_PROFIT,
        eventStartAt: '2027-02-12T00:00:00.000Z',
        eventEndAt: '2027-02-10T00:00:00.000Z',
      }),
    ).toThrow(AppException);
  });

  it('rejects an event end that already passed', () => {
    const now = new Date('2026-10-19T00:00:00.000Z');
    expect(() =>
      assertEventEndInFuture('2026-10-18T23:59:59.000Z', now),
    ).toThrow(AppException);
    expect(() =>
      assertEventEndInFuture('2027-02-12T16:59:59.000Z', now),
    ).not.toThrow();
  });

  it('uses the event end as expiry only when no explicit expiresAt is set', () => {
    const eventEndAt = new Date('2027-02-12T16:59:59.000Z');
    const expiresAt = new Date('2027-03-01T00:00:00.000Z');
    expect(effectiveExpiry({ expiresAt: null, eventEndAt })).toEqual(
      eventEndAt,
    );
    expect(effectiveExpiry({ expiresAt, eventEndAt })).toEqual(expiresAt);
    expect(effectiveExpiry({ expiresAt: null, eventEndAt: null })).toBeNull();
  });
});
