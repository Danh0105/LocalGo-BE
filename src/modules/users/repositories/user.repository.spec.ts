import {
  SessionRevokeReason,
  UserRole,
  UserStatus,
  type User,
} from '../../../../generated/prisma';
import { UserRepository } from './user.repository';
import type { PrismaService } from '../../../database/prisma.service';

describe('UserRepository.updateStatusAndRevokeSessions', () => {
  it('updates status, revokes active sessions and writes audit in one transaction', async () => {
    const target: User = {
      id: 'user-id',
      zaloId: null,
      phone: null,
      email: null,
      displayName: 'User',
      avatarUrl: null,
      passwordHash: null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    let revokeInput: unknown;
    let auditWritten = false;
    const tx = {
      user: {
        update: () =>
          Promise.resolve({ ...target, status: UserStatus.BLOCKED }),
      },
      authSession: {
        updateMany: (input: unknown) => {
          revokeInput = input;
          return Promise.resolve({ count: 2 });
        },
      },
      auditLog: {
        create: () => {
          auditWritten = true;
          return Promise.resolve({});
        },
      },
    };
    const prisma = {
      $transaction: async (
        callback: (client: typeof tx) => Promise<User>,
      ): Promise<User> => callback(tx),
    } as unknown as PrismaService;
    const repository = new UserRepository(prisma);

    await repository.updateStatusAndRevokeSessions({
      actorId: 'admin-id',
      target,
      status: UserStatus.BLOCKED,
    });

    expect(revokeInput).toMatchObject({
      where: { userId: target.id, revokedAt: null },
      data: {
        revokedReason: SessionRevokeReason.ADMIN_REVOKED,
      },
    });
    expect(auditWritten).toBe(true);
  });
});
