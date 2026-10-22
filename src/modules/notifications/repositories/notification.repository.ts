import { Injectable } from '@nestjs/common';
import {
  Prisma,
  UserRole,
  UserStatus,
  type Notification,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import type { NotificationInput } from '../notification-types';

export interface NotificationTradePostTarget {
  id: string;
  slug: string;
  status: string;
  deletedAt: Date | null;
  expiresAt: Date | null;
  eventEndAt: Date | null;
  category: { isActive: boolean; deletedAt: Date | null };
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createForUsers(
    userIds: string[],
    input: NotificationInput,
  ): Promise<Notification[]> {
    return this.prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      })),
    });
  }

  /** Mini app audience for broadcasts: active, non-deleted USER/BUSINESS accounts. */
  async findBroadcastAudience(excludeUserIds: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.USER, UserRole.BUSINESS] },
        id: { notIn: excludeUserIds },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Active, non-deleted staff accounts that use the admin notification bell. */
  async findStaffAudience(excludeUserIds: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.ADMIN, UserRole.MODERATOR] },
        id: { notIn: excludeUserIds },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  async findPage(params: {
    userId: string;
    unreadOnly: boolean;
    skip: number;
    take: number;
  }): Promise<{ items: Notification[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId: params.userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  findOwnedById(userId: string, id: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  async findTradePostTargets(
    ids: string[],
  ): Promise<Map<string, NotificationTradePostTarget>> {
    if (ids.length === 0) return new Map();
    const posts = await this.prisma.tradePost.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        status: true,
        deletedAt: true,
        expiresAt: true,
        eventEndAt: true,
        category: { select: { isActive: true, deletedAt: true } },
      },
    });
    return new Map(posts.map((post) => [post.id, post]));
  }

  async updateResolvedData(
    updates: Array<{ id: string; data: Prisma.InputJsonValue }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.notification.update({
          where: { id: update.id },
          data: { data: update.data },
          select: { id: true },
        }),
      ),
    );
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async countUnreadByUser(userIds: string[]): Promise<Map<string, number>> {
    const rows = await this.prisma.notification.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, readAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.userId, row._count._all]));
  }

  /** Returns false when the notification doesn't exist or isn't the user's. */
  async markRead(userId: string, id: string): Promise<boolean> {
    const owned = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) return false;
    await this.prisma.notification.updateMany({
      where: { id, readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
