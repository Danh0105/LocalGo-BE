import { HttpStatus } from '@nestjs/common';
import { Prisma, TradePostPriceType } from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';

export interface TradePostStateInput {
  categoryCode: string;
  requiresPromotionDetails: boolean;
  priceType: TradePostPriceType;
  price?: number | Prisma.Decimal | null;
  promotionPercent?: number | null;
  promotionStartAt?: Date | string | null;
  promotionEndAt?: Date | string | null;
}

/**
 * Validates the *resulting* state of a trade post (after merging any patch
 * onto the current row for updates) against the spec's cross-field rules:
 * FIXED price type requires a positive price; categories flagged with
 * requiresPromotionDetails need all three promotion fields and other
 * categories may not set them;
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

  if (input.requiresPromotionDetails) {
    if (
      input.promotionPercent == null ||
      input.promotionStartAt == null ||
      input.promotionEndAt == null
    ) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `Tin thuộc danh mục ${input.categoryCode} bắt buộc phải có promotionPercent, promotionStartAt và promotionEndAt`,
        HttpStatus.BAD_REQUEST,
      );
    }
  } else if (hasPromotionInfo) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      'Danh mục này không được có thông tin khuyến mãi',
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
