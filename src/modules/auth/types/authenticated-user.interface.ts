import type { UserRole } from '../../../../generated/prisma';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string | null;
  displayName: string;
}
