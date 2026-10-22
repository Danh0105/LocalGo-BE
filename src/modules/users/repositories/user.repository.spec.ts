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
      credentialVersion: 0,
      role: UserRole.USER,
      businessType: null,
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

describe('UserRepository.getDeletionCounts', () => {
  it('includes password tokens, related audit rows and harvest-batch media', async () => {
    const emptyFindMany = jest.fn().mockResolvedValue([]);
    const zeroCount = jest.fn().mockResolvedValue(0);
    const notificationCount = jest.fn((args: unknown): Promise<number> => {
      void args;
      return Promise.resolve(2);
    });
    const auditCount = jest.fn((args: unknown): Promise<number> => {
      void args;
      return Promise.resolve(3);
    });
    const harvestBatchImageFindMany = jest
      .fn()
      .mockResolvedValue([{ mediaId: 'harvest-media' }]);
    const prisma = {
      businessProfile: { findMany: emptyFindMany },
      tradePost: { findMany: emptyFindMany },
      contentReview: { findMany: emptyFindMany },
      businessApplication: { findMany: emptyFindMany },
      feedbackTicket: { findMany: emptyFindMany },
      harvestBatch: {
        findMany: jest.fn().mockResolvedValue([{ id: 'harvest-batch' }]),
      },
      tradeReview: { findMany: emptyFindMany },
      tradeConversation: { findMany: emptyFindMany },
      feedbackMessage: { findMany: emptyFindMany },
      authSession: { count: zeroCount },
      passwordResetToken: { count: jest.fn().mockResolvedValue(1) },
      tradeReviewCustomerReply: { count: zeroCount },
      tradeMessage: { count: zeroCount },
      savedTradePost: { count: zeroCount },
      notification: { count: notificationCount },
      auditLog: { count: auditCount },
      media: { findMany: emptyFindMany },
      tradePostImage: { findMany: emptyFindMany },
      tradeReviewImage: { findMany: emptyFindMany },
      contentReviewImage: { findMany: emptyFindMany },
      businessApplicationDocument: { findMany: emptyFindMany },
      feedbackTicketMedia: { findMany: emptyFindMany },
      feedbackMessageMedia: { findMany: emptyFindMany },
      harvestBatchImage: { findMany: harvestBatchImageFindMany },
    } as unknown as PrismaService;
    const repository = new UserRepository(prisma);

    const result = await repository.getDeletionCounts('user-id');

    expect(result).toMatchObject({
      passwordResetTokens: 1,
      notifications: 2,
      auditLogs: 3,
      harvestBatches: 1,
      mediaFiles: 1,
    });
    expect(harvestBatchImageFindMany).toHaveBeenCalledWith({
      where: { harvestBatchId: { in: ['harvest-batch'] } },
      select: { mediaId: true },
    });
    const notificationArgs = notificationCount.mock.calls[0][0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(notificationArgs.where.OR).toContainEqual({
      data: {
        path: ['harvestBatchId'],
        equals: 'harvest-batch',
      },
    });
  });
});
