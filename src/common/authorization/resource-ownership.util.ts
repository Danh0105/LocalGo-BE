import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.interface';

/**
 * Reusable "owner OR elevated role" ownership check, shared by every
 * owned-resource module (TradePost, TradeReview, Media, and future
 * content-domain modules). Throws 403 rather than leaking a distinction
 * between "not found" and "not yours" to avoid resource enumeration.
 */
export function assertCanManage(
  user: AuthenticatedUser,
  resource: { ownerId: string },
  allowRoles: UserRole[] = [UserRole.MODERATOR, UserRole.ADMIN],
): void {
  if (resource.ownerId !== user.id && !allowRoles.includes(user.role)) {
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
  }
}
