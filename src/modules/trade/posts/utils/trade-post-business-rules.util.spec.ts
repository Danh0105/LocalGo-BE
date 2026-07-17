import {
  TradePostCategory,
  TradePostPriceType,
} from '../../../../../generated/prisma';
import { AppException } from '../../../../common/exceptions/app.exception';
import { assertValidTradePostState } from './trade-post-business-rules.util';

describe('assertValidTradePostState', () => {
  it('rejects FIXED price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PRODUCT,
        priceType: TradePostPriceType.FIXED,
        price: null,
      }),
    ).toThrow(AppException);
  });

  it('rejects FIXED price type with a zero price', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PRODUCT,
        priceType: TradePostPriceType.FIXED,
        price: 0,
      }),
    ).toThrow(AppException);
  });

  it('accepts FIXED price type with a positive price', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PRODUCT,
        priceType: TradePostPriceType.FIXED,
        price: 150000,
      }),
    ).not.toThrow();
  });

  it('accepts NEGOTIABLE price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PRODUCT,
        priceType: TradePostPriceType.NEGOTIABLE,
        price: null,
      }),
    ).not.toThrow();
  });

  it('accepts CONTACT price type without a price', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.SERVICE,
        priceType: TradePostPriceType.CONTACT,
        price: null,
      }),
    ).not.toThrow();
  });

  it('rejects PROMOTION category missing promotion fields', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PROMOTION,
        priceType: TradePostPriceType.CONTACT,
      }),
    ).toThrow(AppException);
  });

  it('accepts PROMOTION category with all promotion fields and a valid date range', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PROMOTION,
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
        category: TradePostCategory.PRODUCT,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 10,
      }),
    ).toThrow(AppException);
  });

  it('rejects promotionStartAt >= promotionEndAt', () => {
    expect(() =>
      assertValidTradePostState({
        category: TradePostCategory.PROMOTION,
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
        category: TradePostCategory.PROMOTION,
        priceType: TradePostPriceType.CONTACT,
        promotionPercent: 15,
        promotionStartAt: '2026-08-01T00:00:00.000Z',
        promotionEndAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toThrow(AppException);
  });
});
