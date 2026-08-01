import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ErrorCode } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

interface ValidationErrorDetail {
  field: string;
  messages: string[];
}

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    const current =
      messages.length > 0
        ? [
            {
              field,
              messages,
            },
          ]
        : [];

    return [
      ...current,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}

export function createValidationException(
  errors: ValidationError[],
): AppException {
  const details = flattenValidationErrors(errors);
  return new AppException(
    ErrorCode.VALIDATION_ERROR,
    'Dữ liệu nhập không hợp lệ, vui lòng kiểm tra lại các trường bị lỗi',
    HttpStatus.BAD_REQUEST,
    details,
  );
}
