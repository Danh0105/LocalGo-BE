import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { AuthSession } from '../../../../generated/prisma';
import { SessionRevokeReason } from '../../../../generated/prisma';
import { AppException } from '../../../common/exceptions/app.exception';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { SessionRepository } from '../repositories/session.repository';
import { SessionService } from './session.service';

function buildSession(overrides: Partial<AuthSession> = {}): AuthSession {
  const now = new Date();
  return {
    id: 'session-1',
    familyId: 'session-1',
    userId: 'user-1',
    refreshTokenHash: '',
    userAgent: null,
    ipAddress: null,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
    replacedAt: null,
    replacedByTokenId: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: now,
    ...overrides,
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let repository: jest.Mocked<SessionRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const repositoryMock: jest.Mocked<SessionRepository> = {
      findById: jest.fn(),
      create: jest.fn(),
      createAndReplace: jest.fn(),
      revoke: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
      findActiveLeavesForUser: jest.fn(),
    } as unknown as jest.Mocked<SessionRepository>;

    const auditLogServiceMock: jest.Mocked<AuditLogService> = {
      write: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SessionRepository, useValue: repositoryMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
      ],
    }).compile();

    service = module.get(SessionService);
    repository = module.get(SessionRepository);
    auditLogService = module.get(AuditLogService);
  });

  describe('createFamily', () => {
    it('hashes the refresh token and uses the given id as both id and familyId', async () => {
      repository.create.mockImplementation((data) =>
        Promise.resolve(buildSession(data as Partial<AuthSession>)),
      );

      const result = await service.createFamily({
        id: 'family-1',
        userId: 'user-1',
        refreshToken: 'plain-refresh-token',
        ttlMs: 1000 * 60 * 60,
      });

      expect(repository.create).toHaveBeenCalledTimes(1);
      const createArg = repository.create.mock.calls[0][0];
      expect(createArg.id).toBe('family-1');
      expect(createArg.familyId).toBe('family-1');
      expect(createArg.refreshTokenHash).not.toBe('plain-refresh-token');
      await expect(
        argon2.verify(createArg.refreshTokenHash, 'plain-refresh-token'),
      ).resolves.toBe(true);
      expect(result.id).toBe('family-1');
    });
  });

  describe('rotate', () => {
    it('succeeds for a valid, unused, unexpired token and preserves the absolute expiry', async () => {
      const plainToken = 'old-refresh-token';
      const hash = await argon2.hash(plainToken);
      const existing = buildSession({ refreshTokenHash: hash });
      repository.findById.mockResolvedValue(existing);
      repository.createAndReplace.mockImplementation((params) =>
        Promise.resolve(
          buildSession(params.newSession as Partial<AuthSession>),
        ),
      );

      const result = await service.rotate({
        sessionId: existing.id,
        presentedToken: plainToken,
        newSessionId: 'session-2',
        newRefreshToken: 'new-refresh-token',
      });

      expect(repository.createAndReplace).toHaveBeenCalledTimes(1);
      const args = repository.createAndReplace.mock.calls[0][0];
      expect(args.oldSessionId).toBe(existing.id);
      expect(args.newSession.familyId).toBe(existing.familyId);
      expect(args.newSession.expiresAt).toBe(existing.expiresAt);
      expect(result.id).toBe('session-2');
      expect(repository.revokeFamily).not.toHaveBeenCalled();
    });

    it('rejects when the session id is unknown', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.rotate({
          sessionId: 'missing',
          presentedToken: 'x',
          newSessionId: 'session-2',
          newRefreshToken: 'y',
        }),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.createAndReplace).not.toHaveBeenCalled();
    });

    it('rejects an already-revoked session', async () => {
      repository.findById.mockResolvedValue(
        buildSession({ revokedAt: new Date() }),
      );

      await expect(
        service.rotate({
          sessionId: 'session-1',
          presentedToken: 'x',
          newSessionId: 'session-2',
          newRefreshToken: 'y',
        }),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.createAndReplace).not.toHaveBeenCalled();
    });

    it('rejects when the presented token does not match the stored hash', async () => {
      const hash = await argon2.hash('correct-token');
      repository.findById.mockResolvedValue(
        buildSession({ refreshTokenHash: hash }),
      );

      await expect(
        service.rotate({
          sessionId: 'session-1',
          presentedToken: 'wrong-token',
          newSessionId: 'session-2',
          newRefreshToken: 'y',
        }),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.createAndReplace).not.toHaveBeenCalled();
    });

    it('revokes the whole family and rejects on replay of an already-rotated token', async () => {
      const plainToken = 'stolen-old-token';
      const hash = await argon2.hash(plainToken);
      repository.findById.mockResolvedValue(
        buildSession({
          refreshTokenHash: hash,
          replacedAt: new Date(),
          replacedByTokenId: 'session-2-already-issued',
        }),
      );

      await expect(
        service.rotate({
          sessionId: 'session-1',
          presentedToken: plainToken,
          newSessionId: 'session-3-attacker',
          newRefreshToken: 'z',
        }),
      ).rejects.toBeInstanceOf(AppException);

      expect(repository.revokeFamily).toHaveBeenCalledWith(
        'session-1',
        SessionRevokeReason.REUSE_DETECTED,
      );
      expect(repository.createAndReplace).not.toHaveBeenCalled();
      expect(auditLogService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
          resourceType: 'AuthSession',
        }),
      );
    });

    it('rejects an expired session', async () => {
      const plainToken = 'old-refresh-token';
      const hash = await argon2.hash(plainToken);
      repository.findById.mockResolvedValue(
        buildSession({
          refreshTokenHash: hash,
          expiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.rotate({
          sessionId: 'session-1',
          presentedToken: plainToken,
          newSessionId: 'session-2',
          newRefreshToken: 'y',
        }),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.createAndReplace).not.toHaveBeenCalled();
    });
  });

  describe('revokeOwnedSession', () => {
    it('revokes when the session belongs to the requesting user', async () => {
      repository.findById.mockResolvedValue(buildSession({ userId: 'user-1' }));

      await service.revokeOwnedSession('session-1', 'user-1');

      expect(repository.revoke).toHaveBeenCalledWith(
        'session-1',
        SessionRevokeReason.LOGOUT,
      );
    });

    it('throws without revoking when the session belongs to someone else', async () => {
      repository.findById.mockResolvedValue(
        buildSession({ userId: 'other-user' }),
      );

      await expect(
        service.revokeOwnedSession('session-1', 'user-1'),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.revoke).not.toHaveBeenCalled();
    });

    it('throws when the session does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.revokeOwnedSession('missing', 'user-1'),
      ).rejects.toBeInstanceOf(AppException);
      expect(repository.revoke).not.toHaveBeenCalled();
    });
  });
});
