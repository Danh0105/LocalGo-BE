import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  BusinessType,
  UserRole,
  UserStatus,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { UserService } from '../../users/services/user.service';

/**
 * Harvest batches and QR labels are for garden-owner member accounts only:
 * role BUSINESS, status ACTIVE, businessType GARDEN (set when a GARDEN
 * business application is approved). Runs after the global JWT guard.
 */
@Injectable()
export class GardenOwnerGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return false;

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
    if (profile.businessType !== BusinessType.GARDEN) {
      throw new AppException(
        ErrorCode.GARDEN_ACCOUNT_REQUIRED,
        'Chức năng truy xuất nguồn gốc chỉ dành cho tài khoản Chủ vườn – nhà vườn.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
