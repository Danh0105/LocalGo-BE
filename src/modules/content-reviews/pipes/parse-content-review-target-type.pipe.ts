import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import type { ContentReviewTargetType } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  CONTENT_REVIEW_TARGET_TO_DB,
  CONTENT_REVIEW_TARGET_TYPES,
  isContentReviewTargetTypeName,
} from '../content-review.constants';

/** `:targetType` path segment (`temples`, `festivals`, ...) -> DB enum; unknown sections are a 404. */
@Injectable()
export class ParseContentReviewTargetTypePipe implements PipeTransform<
  string,
  ContentReviewTargetType
> {
  transform(value: string): ContentReviewTargetType {
    if (!isContentReviewTargetTypeName(value)) {
      throw new AppException(
        ErrorCode.CONTENT_REVIEW_TARGET_NOT_FOUND,
        `Mục không hỗ trợ đánh giá. Giá trị hợp lệ: ${CONTENT_REVIEW_TARGET_TYPES.join(', ')}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return CONTENT_REVIEW_TARGET_TO_DB[value];
  }
}
