import { HttpStatus } from '@nestjs/common';
import {
  Prisma,
  TradePostPriceType,
  TradePostPurpose,
} from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';

export interface TradePostStateInput {
  categoryCode: string;
  requiresPromotionDetails: boolean;
  /** Defaults to COMMERCIAL. */
  purpose?: TradePostPurpose;
  priceType?: TradePostPriceType | null;
  price?: number | Prisma.Decimal | null;
  promotionPercent?: number | null;
  promotionStartAt?: Date | string | null;
  promotionEndAt?: Date | string | null;
  eventStartAt?: Date | string | null;
  eventEndAt?: Date | string | null;
}

/**
 * Validates the *resulting* state of a trade post (after merging any patch
 * onto the current row for updates) against the spec's cross-field rules:
 * COMMERCIAL posts need a price type, and FIXED requires a positive price;
 * NON_PROFIT posts carry no price and cannot sit in a promotion category;
 * categories flagged with requiresPromotionDetails need all three promotion
 * fields and other categories may not set them; promotion start must precede
 * its end and an event cannot end before it starts.
 */
export function assertValidTradePostState(input: TradePostStateInput): void {
  const purpose = input.purpose ?? TradePostPurpose.COMMERCIAL;
  if (purpose === TradePostPurpose.COMMERCIAL && input.priceType == null) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      'Tin có lợi nhuận phải chọn loại giá (priceType)',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    purpose === TradePostPurpose.NON_PROFIT &&
    input.requiresPromotionDetails
  ) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      `Tin phi lợi nhuận không thể thuộc danh mục khuyến mãi ${input.categoryCode}`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (input.eventStartAt != null && input.eventEndAt != null) {
    const start = new Date(input.eventStartAt).getTime();
    const end = new Date(input.eventEndAt).getTime();
    if (start > end) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Thời điểm bắt đầu sự kiện (eventStartAt) không được sau thời điểm kết thúc (eventEndAt)',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

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

/**
 * Rejects a client-supplied expiry that is not strictly in the future. Public
 * listings hide posts whose expiresAt has passed, so accepting one would let a
 * post be approved yet never be visible. `null`/`undefined` mean "no expiry".
 */
export function assertExpiresAtInFuture(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): void {
  assertInFuture(
    expiresAt,
    'Ngày hết hạn (expiresAt) phải sau thời điểm hiện tại. Bỏ trống nếu tin không có hạn.',
    now,
  );
}

/**
 * Same reasoning as expiresAt: without an explicit expiresAt, eventEndAt is
 * the post's effective expiry, so an event that already ended would publish
 * an invisible post.
 */
export function assertEventEndInFuture(
  eventEndAt: Date | string | null | undefined,
  now: Date = new Date(),
): void {
  assertInFuture(
    eventEndAt,
    'Thời điểm kết thúc sự kiện (eventEndAt) phải sau thời điểm hiện tại.',
    now,
  );
}

function assertInFuture(
  value: Date | string | null | undefined,
  message: string,
  now: Date,
): void {
  if (value != null && new Date(value).getTime() <= now.getTime()) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Whether a post is visible on the public endpoints right now: published,
 * not deleted, in an active category and not past its effective expiry.
 * Same rule as the list filter (notExpiredWhere) and the detail endpoint.
 */
export function isPubliclyVisible(
  post: {
    status: string;
    deletedAt: Date | null;
    expiresAt: Date | null;
    eventEndAt: Date | null;
    category: { isActive: boolean; deletedAt: Date | null };
  },
  now: number = Date.now(),
): boolean {
  const expiry = effectiveExpiry(post);
  return (
    post.status === 'PUBLISHED' &&
    post.deletedAt === null &&
    post.category.isActive &&
    post.category.deletedAt === null &&
    (expiry === null || expiry.getTime() > now)
  );
}

/** When a post stops being public: explicit expiresAt, else the event's end. */
export function effectiveExpiry(post: {
  expiresAt: Date | null;
  eventEndAt: Date | null;
}): Date | null {
  return post.expiresAt ?? post.eventEndAt;
}

/** Prisma filter matching posts whose effective expiry has not passed. */
export function notExpiredWhere(
  now: Date = new Date(),
): Prisma.TradePostWhereInput {
  return {
    OR: [
      { expiresAt: { gt: now } },
      {
        expiresAt: null,
        OR: [{ eventEndAt: null }, { eventEndAt: { gt: now } }],
      },
    ],
  };
}
