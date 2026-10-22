import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TradePostStatus,
  type TradeMessage,
} from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import { notExpiredWhere } from '../../posts/utils/trade-post-business-rules.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

const PARTY_SELECT = {
  select: { id: true, displayName: true, avatarUrl: true },
} as const;

export const CONVERSATION_INCLUDE = {
  tradePost: {
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnailUrl: true,
      status: true,
    },
  },
  customer: PARTY_SELECT,
  owner: PARTY_SELECT,
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.TradeConversationInclude;

export type TradeConversationRecord = Prisma.TradeConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

const NEWEST_FIRST: Prisma.TradeMessageOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

@Injectable()
export class TradeConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A post a customer may start a chat about: published and publicly visible. */
  findChattablePost(
    tradePostId: string,
  ): Promise<{ id: string; ownerId: string } | null> {
    return this.prisma.tradePost.findFirst({
      where: {
        id: tradePostId,
        deletedAt: null,
        status: TradePostStatus.PUBLISHED,
        category: { isActive: true, deletedAt: null },
        AND: [notExpiredWhere()],
      },
      select: { id: true, ownerId: true },
    });
  }

  /**
   * Reuses the (post, customer) thread or opens it, adds the message and bumps
   * lastMessageAt — all in one transaction.
   */

  async openWithMessage(params: {
    tradePostId: string;
    customerId: string;
    ownerId: string;
    content: string;
  }): Promise<{
    conversationId: string;
    created: boolean;
    message: TradeMessage;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const where = {
        tradePostId_customerId: {
          tradePostId: params.tradePostId,
          customerId: params.customerId,
        },
      };

      const existing = await tx.tradeConversation.findUnique({
        where,
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (existing?.deletedAt) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Hội thoại đã bị quản trị viên xóa',
          HttpStatus.GONE,
        );
      }

      // Tạo mới hoặc lấy hội thoại hiện có
      const conversation = await tx.tradeConversation.upsert({
        where,
        create: {
          tradePostId: params.tradePostId,
          customerId: params.customerId,
          ownerId: params.ownerId,
        },
        update: {},
      });

      // Khóa hội thoại, đồng thời kiểm tra trạng thái xóa
      const locked = await tx.tradeConversation.updateMany({
        where: {
          id: conversation.id,
          deletedAt: null,
        },
        data: {
          lastMessageAt: new Date(),
        },
      });

      if (locked.count !== 1) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Hội thoại đã bị quản trị viên xóa',
          HttpStatus.GONE,
        );
      }

      const message = await tx.tradeMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: params.customerId,
          content: params.content,
        },
      });

      await tx.tradeConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
        },
      });

      return {
        conversationId: conversation.id,
        created: !existing,
        message,
      };
    });
  }

  findForParticipant(
    id: string,
    userId: string,
  ): Promise<TradeConversationRecord | null> {
    return this.prisma.tradeConversation.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ customerId: userId }, { ownerId: userId }],
      },
      include: CONVERSATION_INCLUDE,
    });
  }

  async findPageForParticipant(params: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<{ items: TradeConversationRecord[]; total: number }> {
    const where: Prisma.TradeConversationWhereInput = {
      deletedAt: null,
      OR: [{ customerId: params.userId }, { ownerId: params.userId }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeConversation.findMany({
        where,
        include: CONVERSATION_INCLUDE,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.tradeConversation.count({ where }),
    ]);
    return { items, total };
  }

  /** Unread = sent by the other party and not read yet, per conversation. */
  async countUnread(
    conversationIds: string[],
    readerId: string,
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.prisma.tradeMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: readerId },
        readAt: null,
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.conversationId, row._count._all]));
  }

  /** Newest `take` messages after skipping `skip`, returned oldest-first. */
  async findMessagePage(params: {
    conversationId: string;
    skip: number;
    take: number;
  }): Promise<{ items: TradeMessage[]; total: number }> {
    const where = { conversationId: params.conversationId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeMessage.findMany({
        where,
        orderBy: NEWEST_FIRST,
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.tradeMessage.count({ where }),
    ]);
    return { items: items.reverse(), total };
  }

  async addMessage(params: {
    conversationId: string;
    senderId: string;
    content: string;
  }): Promise<TradeMessage> {
    return this.prisma.$transaction(async (tx) => {
      // Lock hội thoại bằng UPDATE có điều kiện
      const result = await tx.tradeConversation.updateMany({
        where: {
          id: params.conversationId,
          deletedAt: null,
          OR: [{ customerId: params.senderId }, { ownerId: params.senderId }],
        },
        data: {
          lastMessageAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Hội thoại không tồn tại hoặc đã bị xóa',
          HttpStatus.NOT_FOUND,
        );
      }

      // Chỉ tạo tin nhắn sau khi lock thành công
      const message = await tx.tradeMessage.create({
        data: {
          conversationId: params.conversationId,
          senderId: params.senderId,
          content: params.content,
        },
      });

      // Cập nhật thời gian tin nhắn thực tế
      await tx.tradeConversation.update({
        where: { id: params.conversationId },
        data: { lastMessageAt: message.createdAt },
      });

      return message;
    });
  }

  async markReadFromOtherParty(
    conversationId: string,
    readerId: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.tradeConversation.findFirst({
        where: {
          id: conversationId,
          deletedAt: null,
          OR: [{ customerId: readerId }, { ownerId: readerId }],
        },
        select: { id: true },
      });

      if (!conversation) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Hội thoại không tồn tại hoặc đã bị xóa',
          HttpStatus.NOT_FOUND,
        );
      }

      const result = await tx.tradeMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: readerId },
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return result.count;
    });
  }
}
