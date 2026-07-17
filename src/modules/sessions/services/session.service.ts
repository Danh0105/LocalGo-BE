import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionRevokeReason } from '../../../../generated/prisma';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { SessionEntity } from '../entities/session.entity';
import { SessionRepository } from '../repositories/session.repository';

export interface CreateSessionParams {
  /** Client-generated id, used as both the row id and the family id. */
  id: string;
  userId: string;
  /** Plaintext refresh token (JWT string) to be hashed and stored. */
  refreshToken: string;
  ttlMs: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface RotateSessionParams {
  /** The `sid` claim carried by the presented (old) refresh token. */
  sessionId: string;
  /** The raw old refresh token string, verified against the stored hash. */
  presentedToken: string;
  /** Client-generated id for the replacement row. */
  newSessionId: string;
  /** Plaintext new refresh token (JWT string) to be hashed and stored. */
  newRefreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Refresh-token rotation with reuse detection ("rotation-family" pattern).
 *
 * Each login starts a family (familyId = the first row's own id). Each
 * refresh creates a NEW row in the same family (never mutates the old row's
 * secret in place) and marks the presented row `replacedAt/replacedByTokenId`.
 * The family's `expiresAt` is fixed at creation and never pushed forward on
 * rotation, so a stolen-but-still-rotating token cannot keep a session alive
 * indefinitely.
 *
 * Presenting a token whose row already has `replacedByTokenId` set means
 * that exact token was already exchanged once and is now being replayed —
 * this revokes every row in the family and surfaces a distinct error so the
 * caller can audit-log a REUSE_DETECTED event.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createFamily(params: CreateSessionParams): Promise<SessionEntity> {
    const refreshTokenHash = await argon2.hash(params.refreshToken);
    const expiresAt = new Date(Date.now() + params.ttlMs);

    const session = await this.sessionRepository.create({
      id: params.id,
      familyId: params.id,
      userId: params.userId,
      refreshTokenHash,
      expiresAt,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    });

    return new SessionEntity(session);
  }

  async rotate(params: RotateSessionParams): Promise<SessionEntity> {
    const session = await this.sessionRepository.findById(params.sessionId);

    if (!session || session.revokedAt) {
      throw this.invalidRefreshToken();
    }

    const hashMatches = await argon2
      .verify(session.refreshTokenHash, params.presentedToken)
      .catch(() => false);
    if (!hashMatches) {
      throw this.invalidRefreshToken();
    }

    if (session.replacedByTokenId) {
      // Replay of an already-rotated-away token: treat the whole family as
      // compromised and revoke it, rather than trusting this branch alone.
      await this.sessionRepository.revokeFamily(
        session.familyId,
        SessionRevokeReason.REUSE_DETECTED,
      );
      await this.auditLogService.write({
        actorId: session.userId,
        action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        resourceType: 'AuthSession',
        resourceId: session.familyId,
      });
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Refresh token đã được sử dụng trước đó, tất cả phiên đăng nhập liên quan đã bị thu hồi',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw this.invalidRefreshToken();
    }

    const newRefreshTokenHash = await argon2.hash(params.newRefreshToken);
    const created = await this.sessionRepository.createAndReplace({
      newSession: {
        id: params.newSessionId,
        familyId: session.familyId,
        userId: session.userId,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: session.expiresAt,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
      },
      oldSessionId: session.id,
    });

    return new SessionEntity(created);
  }

  async revoke(
    sessionId: string,
    reason: SessionRevokeReason = SessionRevokeReason.LOGOUT,
  ): Promise<void> {
    await this.sessionRepository.revoke(sessionId, reason);
  }

  async revokeOwnedSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy phiên đăng nhập',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.sessionRepository.revoke(sessionId, SessionRevokeReason.LOGOUT);
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason = SessionRevokeReason.LOGOUT,
  ): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId, reason);
  }

  async listActiveSessions(userId: string): Promise<SessionEntity[]> {
    const sessions =
      await this.sessionRepository.findActiveLeavesForUser(userId);
    return sessions.map((session) => new SessionEntity(session));
  }

  private invalidRefreshToken(): AppException {
    return new AppException(
      ErrorCode.INVALID_REFRESH_TOKEN,
      'Refresh token không hợp lệ hoặc đã hết hạn',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
