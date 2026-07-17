import { HttpStatus } from '@nestjs/common';
import {
  Prisma,
  TradePostCategory,
  TradePostPriceType,
} from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';

export interface TradePostStateInput {
  category: TradePostCategory;
  priceType: TradePostPriceType;
  price?: number | Prisma.Decimal | null;
  promotionPercent?: number | null;
  promotionStartAt?: Date | string | null;
  promotionEndAt?: Date | string | null;
}

/**
 * Validates the *resulting* state of a trade post (after merging any patch
 * onto the current row for updates) against the spec's cross-field rules:
 * FIXED price type requires a positive price; PROMOTION category requires
 * all three promotion fields together and only PROMOTION may set them;
 * promotion start must precede its end.
 */
export function assertValidTradePostState(input: TradePostStateInput): void {
  if (input.priceType === TradePostPriceType.FIXED) {
    const numericPrice =
      input.price == null ? null : Number(input.price.toString());
    if (numericPrice === null || numericPrice <= 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Loại giá "Cố định" (FIXED) bắt buộc phải có giá lớn hơn 0',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  const hasPromotionInfo =
    input.promotionPercent != null ||
    input.promotionStartAt != null ||
    input.promotionEndAt != null;

  if (input.category === TradePostCategory.PROMOTION) {
    if (
      input.promotionPercent == null ||
      input.promotionStartAt == null ||
      input.promotionEndAt == null
    ) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Tin khuyến mãi (PROMOTION) bắt buộc phải có promotionPercent, promotionStartAt và promotionEndAt',
        HttpStatus.BAD_REQUEST,
      );
    }
  } else if (hasPromotionInfo) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      'Chỉ tin thuộc danh mục khuyến mãi (PROMOTION) mới được có thông tin khuyến mãi',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (input.promotionStartAt != null && input.promotionEndAt != null) {
    const start = new Date(input.promotionStartAt).getTime();
    const end = new Date(input.promotionEndAt).getTime();
    if (start >= end) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'promotionStartAt phải nhỏ hơn promotionEndAt',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
