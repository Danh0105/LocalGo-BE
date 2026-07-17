import type { AuthSession } from '../../../../generated/prisma';

/**
 * Domain-shape mapper: DB row -> safe internal object.
 * Deliberately excludes refreshTokenHash and internal rotation-chain
 * bookkeeping (replacedByTokenId/revokedReason) — never leaks past this
 * boundary.
 */
export class SessionEntity {
  id: string;
  familyId: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;

  constructor(session: AuthSession) {
    this.id = session.id;
    this.familyId = session.familyId;
    this.userId = session.userId;
    this.userAgent = session.userAgent;
    this.ipAddress = session.ipAddress;
    this.issuedAt = session.issuedAt;
    this.expiresAt = session.expiresAt;
    this.revokedAt = session.revokedAt;
  }
}
