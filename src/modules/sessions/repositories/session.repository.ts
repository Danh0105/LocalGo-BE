import { Injectable } from '@nestjs/common';
import type {
  AuthSession,
  Prisma,
  SessionRevokeReason,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<AuthSession | null> {
    return this.prisma.authSession.findUnique({ where: { id } });
  }

  create(data: Prisma.AuthSessionUncheckedCreateInput): Promise<AuthSession> {
    return this.prisma.authSession.create({ data });
  }

  /**
   * Atomically inserts the new (rotated) session row and marks the
   * presented row as replaced, so a crash between the two writes can
   * never leave a session that looks "current" in two places at once.
   */
  createAndReplace(params: {
    newSession: Prisma.AuthSessionUncheckedCreateInput;
    oldSessionId: string;
  }): Promise<AuthSession> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.authSession.create({
        data: params.newSession,
      });
      await tx.authSession.update({
        where: { id: params.oldSessionId },
        data: { replacedAt: new Date(), replacedByTokenId: created.id },
      });
      return created;
    });
  }

  revoke(id: string, reason: SessionRevokeReason): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  revokeFamily(
    familyId: string,
    reason: SessionRevokeReason,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  findActiveLeavesForUser(userId: string): Promise<AuthSession[]> {
    return this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        replacedByTokenId: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
