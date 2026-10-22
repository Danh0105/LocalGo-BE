import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { UserService } from '../../users/services/user.service';

const ALLOW_STAFF_KEY = 'sellerAccess:allowStaff';

/**
 * Seller-center routes (manage own posts, analytics, review replies) are
 * only for ACTIVE accounts with role BUSINESS. With `allowStaff`, ADMIN and
 * MODERATOR pass too — the handler still checks resource ownership.
 * Runs after the global JWT guard, so `request.user` is set; BLOCKED users
 * never get this far (the JWT strategy rejects them), PENDING ones do.
 */
@Injectable()
export class SellerAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return false;

    const allowStaff = this.reflector.getAllAndOverride<boolean>(
      ALLOW_STAFF_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      allowStaff &&
      (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR)
    ) {
      return true;
    }

    if (user.role !== UserRole.BUSINESS) {
      throw new AppException(
        ErrorCode.BUSINESS_PROFILE_REQUIRED,
        'Chức năng này dành cho tài khoản Business đã được duyệt. Vui lòng nộp hồ sơ đăng ký.',
        HttpStatus.FORBIDDEN,
      );
    }
    const profile = await this.userService.getProfile(user.id);
    if (profile.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_ACTIVE,
        'Tài khoản Business chưa được kích hoạt.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}

/** Restricts a route to ACTIVE BUSINESS accounts (optionally also ADMIN/MODERATOR). */
export function SellerAccess(options: { allowStaff?: boolean } = {}) {
  return applyDecorators(
    SetMetadata(ALLOW_STAFF_KEY, options.allowStaff ?? false),
    UseGuards(SellerAccessGuard),
  );
}
