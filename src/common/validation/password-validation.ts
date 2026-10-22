import type { ValidationOptions } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_STRENGTH_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const PASSWORD_STRENGTH_MESSAGE =
  'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số';

export const PASSWORD_VALIDATION_OPTIONS: ValidationOptions = {
  message: PASSWORD_STRENGTH_MESSAGE,
};
