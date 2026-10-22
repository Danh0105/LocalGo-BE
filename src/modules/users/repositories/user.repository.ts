import { Injectable } from '@nestjs/common';
import {
  SessionRevokeReason,
  type Prisma,
  type User,
  type UserRole,
  type UserStatus,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import type { UserDeletionCountsDto } from '../dto/user-deletion-impact.dto';

type DeletionMediaDb = Pick<
  Prisma.TransactionClient,
  | 'media'
  | 'tradePostImage'
  | 'tradeReviewImage'
  | 'contentReviewImage'
  | 'businessApplicationDocument'
  | 'feedbackTicketMedia'
  | 'feedbackMessageMedia'
  | 'harvestBatchImage'
>;

interface UserDeletionReferences {
  targetId: string;
  businessProfileIds: string[];
  applicationIds: string[];
  tradePostIds: string[];
  tradeReviewIds: string[];
  contentReviewIds: string[];
  conversationIds: string[];
  feedbackTicketIds: string[];
  feedbackMessageIds: string[];
  harvestBatchIds: string[];
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByZaloId(zaloId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { zaloId, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  emailExists(email: string): Promise<boolean> {
    return this.prisma.user
      .count({ where: { email } })
      .then((count) => count > 0);
  }

  phoneExists(phone: string): Promise<boolean> {
    return this.prisma.user
      .count({ where: { phone } })
      .then((count) => count > 0);
  }

  createUserWithAudit(params: {
    actorId: string;
    displayName: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          displayName: params.displayName,
          email: params.email,
          phone: params.phone,
          passwordHash: params.passwordHash,
          role: params.role,
          status: 'ACTIVE',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_CREATED_BY_ADMIN',
          resourceType: 'User',
          resourceId: created.id,
          newData: {
            displayName: created.displayName,
            email: created.email,
            phone: created.phone,
            role: created.role,
            status: created.status,
          },
        },
      });
      return created;
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  touchLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { displayName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortOrder = params.sortOrder ?? 'desc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  updateStatusAndRevokeSessions(params: {
    actorId: string;
    target: User;
    status: UserStatus;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.target.id },
        data: {
          status: params.status,
          ...(params.status === 'BLOCKED'
            ? { credentialVersion: { increment: 1 } }
            : {}),
        },
      });
      if (params.status === 'BLOCKED') {
        await tx.authSession.updateMany({
          where: { userId: params.target.id, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: SessionRevokeReason.ADMIN_REVOKED,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_STATUS_UPDATED',
          resourceType: 'User',
          resourceId: params.target.id,
          oldData: { status: params.target.status },
          newData: { status: params.status },
        },
      });
      return updated;
    });
  }

  updateRole(params: {
    actorId: string;
    target: User;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.target.id },
        data: { role: params.role },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_ROLE_UPDATED',
          resourceType: 'User',
          resourceId: params.target.id,
          oldData: { role: params.target.role },
          newData: { role: params.role },
        },
      });
      return updated;
    });
  }

  updatePasswordAndRevokeSessions(params: {
    actorId: string;
    target: User;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.target.id },
        data: {
          passwordHash: params.passwordHash,
          credentialVersion: { increment: 1 },
        },
      });
      await tx.authSession.updateMany({
        where: { userId: params.target.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: SessionRevokeReason.ADMIN_REVOKED,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: params.target.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_PASSWORD_RESET_BY_ADMIN',
          resourceType: 'User',
          resourceId: params.target.id,
        },
      });
      return updated;
    });
  }

  changeOwnPasswordAndRevokeSessions(params: {
    userId: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.passwordHash,
          credentialVersion: { increment: 1 },
        },
      });
      await tx.authSession.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: SessionRevokeReason.PASSWORD_CHANGE,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: params.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.userId,
          action: 'USER_PASSWORD_CHANGED',
          resourceType: 'User',
          resourceId: params.userId,
        },
      });
      return updated;
    });
  }

  createPasswordResetToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: params.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({ data: params });
      await tx.auditLog.create({
        data: {
          actorId: params.userId,
          action: 'USER_PASSWORD_RESET_REQUESTED',
          resourceType: 'User',
          resourceId: params.userId,
        },
      });
    });
  }

  consumePasswordResetToken(params: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<User | null> {
    return this.prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({
        where: { tokenHash: params.tokenHash },
      });
      if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      const activeUser = await tx.user.findFirst({
        where: { id: reset.userId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!activeUser) return null;

      // Conditional claim makes concurrent submissions of the same token safe.
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: reset.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      const updated = await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: params.passwordHash,
          credentialVersion: { increment: 1 },
        },
      });
      await tx.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: SessionRevokeReason.PASSWORD_CHANGE,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: reset.userId,
          action: 'USER_PASSWORD_RESET_COMPLETED',
          resourceType: 'User',
          resourceId: reset.userId,
        },
      });
      return updated;
    });
  }

  private async findRelatedMediaIds(
    db: DeletionMediaDb,
    params: {
      targetId: string;
      tradePostIds: string[];
      tradeReviewIds: string[];
      contentReviewIds: string[];
      applicationIds: string[];
      feedbackTicketIds: string[];
      feedbackMessageIds: string[];
      harvestBatchIds: string[];
    },
  ): Promise<string[]> {
    const [
      owned,
      post,
      tradeReview,
      contentReview,
      application,
      ticket,
      message,
      harvestBatch,
    ] = await Promise.all([
      db.media.findMany({
        where: { ownerId: params.targetId },
        select: { id: true },
      }),
      db.tradePostImage.findMany({
        where: { tradePostId: { in: params.tradePostIds } },
        select: { mediaId: true },
      }),
      db.tradeReviewImage.findMany({
        where: { tradeReviewId: { in: params.tradeReviewIds } },
        select: { mediaId: true },
      }),
      db.contentReviewImage.findMany({
        where: { contentReviewId: { in: params.contentReviewIds } },
        select: { mediaId: true },
      }),
      db.businessApplicationDocument.findMany({
        where: { applicationId: { in: params.applicationIds } },
        select: { mediaId: true },
      }),
      db.feedbackTicketMedia.findMany({
        where: { ticketId: { in: params.feedbackTicketIds } },
        select: { mediaId: true },
      }),
      db.feedbackMessageMedia.findMany({
        where: { messageId: { in: params.feedbackMessageIds } },
        select: { mediaId: true },
      }),
      db.harvestBatchImage.findMany({
        where: { harvestBatchId: { in: params.harvestBatchIds } },
        select: { mediaId: true },
      }),
    ]);

    return [
      ...new Set([
        ...owned.map(({ id }) => id),
        ...post.map(({ mediaId }) => mediaId),
        ...tradeReview.map(({ mediaId }) => mediaId),
        ...contentReview.map(({ mediaId }) => mediaId),
        ...application.map(({ mediaId }) => mediaId),
        ...ticket.map(({ mediaId }) => mediaId),
        ...message.map(({ mediaId }) => mediaId),
        ...harvestBatch.map(({ mediaId }) => mediaId),
      ]),
    ];
  }

  private getRelatedNotificationWhere(
    references: UserDeletionReferences,
  ): Prisma.NotificationWhereInput {
    const referenceFields: Array<[string, string[]]> = [
      ['applicationId', references.applicationIds],
      ['tradePostId', references.tradePostIds],
      [
        'reviewId',
        [...references.tradeReviewIds, ...references.contentReviewIds],
      ],
      ['conversationId', references.conversationIds],
      ['feedbackTicketId', references.feedbackTicketIds],
      ['feedbackMessageId', references.feedbackMessageIds],
      ['harvestBatchId', references.harvestBatchIds],
    ];
    const resourceReferences = referenceFields.flatMap(([field, ids]) =>
      ids.map((id): Prisma.NotificationWhereInput => ({
        data: { path: [field], equals: id },
      })),
    );
    return {
      OR: [
        { userId: references.targetId },
        {
          data: {
            path: ['submittedById'],
            equals: references.targetId,
          },
        },
        ...resourceReferences,
      ],
    };
  }

  private getRelatedAuditLogWhere(
    references: UserDeletionReferences,
  ): Prisma.AuditLogWhereInput {
    const resourceGroups: Array<[string, string[]]> = [
      ['BusinessProfile', references.businessProfileIds],
      ['BusinessApplication', references.applicationIds],
      ['TradePost', references.tradePostIds],
      ['TradeReview', references.tradeReviewIds],
      ['ContentReview', references.contentReviewIds],
      ['TradeConversation', references.conversationIds],
      ['FeedbackTicket', references.feedbackTicketIds],
      ['FeedbackMessage', references.feedbackMessageIds],
      ['HarvestBatch', references.harvestBatchIds],
    ];
    return {
      OR: [
        { actorId: references.targetId },
        { resourceType: 'User', resourceId: references.targetId },
        ...resourceGroups
          .filter(([, ids]) => ids.length > 0)
          .map(([resourceType, ids]): Prisma.AuditLogWhereInput => ({
            resourceType,
            resourceId: { in: ids },
          })),
      ],
    };
  }

  async getDeletionCounts(targetId: string): Promise<UserDeletionCountsDto> {
    const [
      businessProfiles,
      tradePosts,
      contentReviews,
      applications,
      feedbackTickets,
      harvestBatches,
    ] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where: { userId: targetId },
        select: { id: true },
      }),
      this.prisma.tradePost.findMany({
        where: { ownerId: targetId },
        select: { id: true },
      }),
      this.prisma.contentReview.findMany({
        where: { userId: targetId },
        select: { id: true },
      }),
      this.prisma.businessApplication.findMany({
        where: {
          OR: [{ submittedById: targetId }, { createdUserId: targetId }],
        },
        select: { id: true },
      }),
      this.prisma.feedbackTicket.findMany({
        where: { submittedById: targetId },
        select: { id: true },
      }),
      this.prisma.harvestBatch.findMany({
        where: { ownerId: targetId },
        select: { id: true },
      }),
    ]);
    const businessProfileIds = businessProfiles.map(({ id }) => id);
    const tradePostIds = tradePosts.map(({ id }) => id);
    const contentReviewIds = contentReviews.map(({ id }) => id);
    const applicationIds = applications.map(({ id }) => id);
    const feedbackTicketIds = feedbackTickets.map(({ id }) => id);
    const harvestBatchIds = harvestBatches.map(({ id }) => id);

    const [tradeReviews, conversations, feedbackMessages] = await Promise.all([
      this.prisma.tradeReview.findMany({
        where: {
          OR: [{ userId: targetId }, { tradePostId: { in: tradePostIds } }],
        },
        select: { id: true },
      }),
      this.prisma.tradeConversation.findMany({
        where: {
          OR: [
            { customerId: targetId },
            { ownerId: targetId },
            { tradePostId: { in: tradePostIds } },
          ],
        },
        select: { id: true },
      }),
      this.prisma.feedbackMessage.findMany({
        where: {
          OR: [
            { senderUserId: targetId },
            { ticketId: { in: feedbackTicketIds } },
          ],
        },
        select: { id: true },
      }),
    ]);
    const tradeReviewIds = tradeReviews.map(({ id }) => id);
    const conversationIds = conversations.map(({ id }) => id);
    const feedbackMessageIds = feedbackMessages.map(({ id }) => id);

    const references: UserDeletionReferences = {
      targetId,
      businessProfileIds,
      applicationIds,
      tradePostIds,
      tradeReviewIds,
      contentReviewIds,
      conversationIds,
      feedbackTicketIds,
      feedbackMessageIds,
      harvestBatchIds,
    };

    const [
      authSessions,
      passwordResetTokens,
      reviewReplies,
      messages,
      savedPosts,
      notifications,
      auditLogs,
      mediaFiles,
    ] = await Promise.all([
      this.prisma.authSession.count({ where: { userId: targetId } }),
      this.prisma.passwordResetToken.count({ where: { userId: targetId } }),
      this.prisma.tradeReviewCustomerReply.count({
        where: {
          OR: [{ userId: targetId }, { reviewId: { in: tradeReviewIds } }],
        },
      }),
      this.prisma.tradeMessage.count({
        where: {
          OR: [
            { senderId: targetId },
            { conversationId: { in: conversationIds } },
          ],
        },
      }),
      this.prisma.savedTradePost.count({
        where: {
          OR: [{ userId: targetId }, { tradePostId: { in: tradePostIds } }],
        },
      }),
      this.prisma.notification.count({
        where: this.getRelatedNotificationWhere(references),
      }),
      this.prisma.auditLog.count({
        where: this.getRelatedAuditLogWhere(references),
      }),
      this.findRelatedMediaIds(this.prisma, {
        targetId,
        tradePostIds,
        tradeReviewIds,
        contentReviewIds,
        applicationIds,
        feedbackTicketIds,
        feedbackMessageIds,
        harvestBatchIds,
      }).then((ids) => ids.length),
    ]);

    return {
      authSessions,
      passwordResetTokens,
      businessProfiles: businessProfileIds.length,
      businessApplications: applicationIds.length,
      tradePosts: tradePostIds.length,
      tradeReviews: tradeReviewIds.length,
      contentReviews: contentReviewIds.length,
      reviewReplies,
      conversations: conversationIds.length,
      messages,
      savedPosts,
      notifications,
      auditLogs,
      harvestBatches: harvestBatchIds.length,
      feedbackTickets: feedbackTicketIds.length,
      feedbackMessages: feedbackMessageIds.length,
      mediaFiles,
    };
  }

  deleteAccountAndRelatedData(params: {
    actorId: string;
    targetId: string;
  }): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const [
        businessProfiles,
        tradePosts,
        contentReviews,
        applications,
        feedbackTickets,
        harvestBatches,
      ] = await Promise.all([
        tx.businessProfile.findMany({
          where: { userId: params.targetId },
          select: { id: true },
        }),
        tx.tradePost.findMany({
          where: { ownerId: params.targetId },
          select: { id: true },
        }),
        tx.contentReview.findMany({
          where: { userId: params.targetId },
          select: { id: true },
        }),
        tx.businessApplication.findMany({
          where: {
            OR: [
              { submittedById: params.targetId },
              { createdUserId: params.targetId },
            ],
          },
          select: { id: true },
        }),
        tx.feedbackTicket.findMany({
          where: { submittedById: params.targetId },
          select: { id: true },
        }),
        tx.harvestBatch.findMany({
          where: { ownerId: params.targetId },
          select: { id: true },
        }),
      ]);
      const businessProfileIds = businessProfiles.map(({ id }) => id);
      const tradePostIds = tradePosts.map(({ id }) => id);
      const contentReviewIds = contentReviews.map(({ id }) => id);
      const applicationIds = applications.map(({ id }) => id);
      const feedbackTicketIds = feedbackTickets.map(({ id }) => id);
      const harvestBatchIds = harvestBatches.map(({ id }) => id);

      const [
        tradeReviews,
        conversations,
        feedbackMessages,
        savedPosts,
        events,
      ] = await Promise.all([
        tx.tradeReview.findMany({
          where: {
            OR: [
              { userId: params.targetId },
              { tradePostId: { in: tradePostIds } },
            ],
          },
          select: { id: true, tradePostId: true },
        }),
        tx.tradeConversation.findMany({
          where: {
            OR: [
              { customerId: params.targetId },
              { ownerId: params.targetId },
              { tradePostId: { in: tradePostIds } },
            ],
          },
          select: { id: true },
        }),
        tx.feedbackMessage.findMany({
          where: {
            OR: [
              { senderUserId: params.targetId },
              { ticketId: { in: feedbackTicketIds } },
            ],
          },
          select: { id: true },
        }),
        tx.savedTradePost.findMany({
          where: { userId: params.targetId },
          select: { tradePostId: true },
        }),
        tx.tradePostEvent.findMany({
          where: { userId: params.targetId },
          select: { tradePostId: true },
        }),
      ]);
      const tradeReviewIds = tradeReviews.map(({ id }) => id);
      const conversationIds = conversations.map(({ id }) => id);
      const feedbackMessageIds = feedbackMessages.map(({ id }) => id);
      const references: UserDeletionReferences = {
        targetId: params.targetId,
        businessProfileIds,
        applicationIds,
        tradePostIds,
        tradeReviewIds,
        contentReviewIds,
        conversationIds,
        feedbackTicketIds,
        feedbackMessageIds,
        harvestBatchIds,
      };
      const mediaIds = await this.findRelatedMediaIds(tx, {
        targetId: params.targetId,
        tradePostIds,
        tradeReviewIds,
        contentReviewIds,
        applicationIds,
        feedbackTicketIds,
        feedbackMessageIds,
        harvestBatchIds,
      });

      // Business documents are the only media relation using Restrict. Remove
      // their links first so account-owned files can be purged safely.
      await tx.businessApplicationDocument.deleteMany({
        where: { mediaId: { in: mediaIds } },
      });
      await tx.feedbackMessage.deleteMany({
        where: { id: { in: feedbackMessageIds } },
      });
      await tx.feedbackTicket.deleteMany({
        where: { id: { in: feedbackTicketIds } },
      });
      await tx.tradeReviewCustomerReply.deleteMany({
        where: {
          OR: [
            { userId: params.targetId },
            { reviewId: { in: tradeReviewIds } },
          ],
        },
      });
      await tx.tradeReview.deleteMany({
        where: { id: { in: tradeReviewIds } },
      });
      await tx.contentReview.deleteMany({
        where: { id: { in: contentReviewIds } },
      });
      await tx.harvestBatch.deleteMany({
        where: { ownerId: params.targetId },
      });
      await tx.tradeConversation.deleteMany({
        where: { id: { in: conversationIds } },
      });
      await tx.savedTradePost.deleteMany({
        where: {
          OR: [
            { userId: params.targetId },
            { tradePostId: { in: tradePostIds } },
          ],
        },
      });
      await tx.tradePostEvent.deleteMany({
        where: {
          OR: [
            { userId: params.targetId },
            { tradePostId: { in: tradePostIds } },
          ],
        },
      });
      await tx.tradePost.deleteMany({ where: { id: { in: tradePostIds } } });
      await tx.businessApplication.deleteMany({
        where: { id: { in: applicationIds } },
      });
      await tx.notification.deleteMany({
        where: this.getRelatedNotificationWhere(references),
      });

      const affectedPostIds = [
        ...new Set([
          ...tradeReviews.map(({ tradePostId }) => tradePostId),
          ...savedPosts.map(({ tradePostId }) => tradePostId),
          ...events.map(({ tradePostId }) => tradePostId),
        ]),
      ].filter((id) => !tradePostIds.includes(id));
      for (const tradePostId of affectedPostIds) {
        const [reviewAggregate, saveCount, viewCount] = await Promise.all([
          tx.tradeReview.aggregate({
            where: {
              tradePostId,
              status: 'PUBLISHED',
              deletedAt: null,
            },
            _count: { id: true },
            _avg: { rating: true },
          }),
          tx.savedTradePost.count({ where: { tradePostId } }),
          tx.tradePostEvent.count({
            where: { tradePostId, type: 'VIEW' },
          }),
        ]);
        await tx.tradePost.updateMany({
          where: { id: tradePostId },
          data: {
            reviewCount: reviewAggregate._count.id,
            averageRating: reviewAggregate._avg.rating ?? 0,
            saveCount,
            viewCount,
          },
        });
      }

      await tx.auditLog.deleteMany({
        where: this.getRelatedAuditLogWhere(references),
      });
      await tx.media.updateMany({
        where: { id: { in: mediaIds } },
        data: {
          ownerId: null,
          resourceType: null,
          resourceId: null,
          deletedAt: new Date(),
        },
      });
      await tx.user.delete({ where: { id: params.targetId } });
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_ACCOUNT_DELETED',
          resourceType: 'User',
          resourceId: null,
        },
      });
      return mediaIds;
    });
  }

  async hardDeleteMedia(mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return;
    await this.prisma.media.deleteMany({ where: { id: { in: mediaIds } } });
  }
}
