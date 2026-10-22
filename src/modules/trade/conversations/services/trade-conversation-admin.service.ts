import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../../../generated/prisma';

import { PrismaService } from '../../../../database/prisma.service';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';

const ADMIN_INCLUDE = {
  tradePost: {
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnailUrl: true,
      status: true,
      deletedAt: true,
    },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.TradeConversationInclude;

@Injectable()
export class TradeConversationAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number, tradePostId?: string) {
    const { skip, take } = buildPaginationArgs(page, limit);

    const where: Prisma.TradeConversationWhereInput = {
      deletedAt: null,
      ...(tradePostId ? { tradePostId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeConversation.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.tradeConversation.count({ where }),
    ]);

    return paginate(items, page, limit, total);
  }

  async detail(adminId: string, id: string) {
    const conversation = await this.prisma.tradeConversation.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_INCLUDE,
    });

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }

    await this.logAccess(adminId, id, 'ADMIN_VIEW_CONVERSATION');

    return conversation;
  }

  async messages(adminId: string, id: string, page: number, limit: number) {
    const conversation = await this.prisma.tradeConversation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }

    const { skip, take } = buildPaginationArgs(page, limit);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeMessage.findMany({
        where: { conversationId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.tradeMessage.count({
        where: { conversationId: id },
      }),
    ]);

    await this.logAccess(adminId, id, 'ADMIN_VIEW_MESSAGES');

    return paginate(items.reverse(), page, limit, total);
  }

  async remove(adminId: string, id: string, reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.tradeConversation.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        throw new NotFoundException('Không tìm thấy hội thoại');
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_DELETE_TRADE_CONVERSATION',
          resourceType: 'TradeConversation',
          resourceId: id,
          newData: {
            reason: reason?.trim() || 'Admin xóa hội thoại',
            deletionType: 'SOFT_DELETE',
          },
        },
      });
    });
  }

  private async logAccess(adminId: string, id: string, action: string) {
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action,
        resourceType: 'TradeConversation',
        resourceId: id,
      },
    });
  }
}
