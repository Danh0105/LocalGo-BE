import type { User, UserRole, UserStatus } from '../../../../generated/prisma';

/**
 * Domain-shape mapper: DB row -> safe internal object.
 * Deliberately excludes passwordHash — never leaks past this boundary.
 */
export class UserEntity {
  id: string;
  zaloId: string | null;
  phone: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.zaloId = user.zaloId;
    this.phone = user.phone;
    this.email = user.email;
    this.displayName = user.displayName;
    this.avatarUrl = user.avatarUrl;
    this.role = user.role;
    this.status = user.status;
    this.lastLoginAt = user.lastLoginAt;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
