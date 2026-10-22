import { FeedbackRealtimeGateway } from '../realtime/feedback-realtime.gateway';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FeedbackMessageSenderRole,
  FeedbackTicketStatus,
  MediaResourceType,
  Prisma,
  type FeedbackChannelCategory,
  type FeedbackMessage,
  type FeedbackTicket,
  type Media,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { paginate } from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaEntity } from '../../media/entities/media.entity';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { MediaService } from '../../media/services/media.service';
import {
  NotificationType,
  excerpt,
} from '../../notifications/notification-types';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  FeedbackMessageResponseDto,
  FeedbackTicketAdminResponseDto,
  FeedbackTicketLookupResponseDto,
  SubmitFeedbackTicketResponseDto,
} from '../dto/feedback-ticket-response.dto';
import { LookupFeedbackTicketDto } from '../dto/lookup-feedback-ticket.dto';
import { QueryFeedbackTicketAdminDto } from '../dto/query-feedback-ticket.dto';
import {
  ReplyAnonymousFeedbackTicketDto,
  ReplyFeedbackTicketDto,
} from '../dto/reply-feedback-ticket.dto';
import { SubmitFeedbackTicketDto } from '../dto/submit-feedback-ticket.dto';
import { UpdateFeedbackTicketStatusDto } from '../dto/update-feedback-ticket-status.dto';
import { FEEDBACK_CHANNEL_CATEGORY_FROM_DB } from '../feedback-channel.constants';
import {
  FEEDBACK_TICKET_STATUS_FROM_DB,
  FEEDBACK_TICKET_STATUS_TO_DB,
  MAX_FEEDBACK_ATTACHMENTS,
  MAX_FEEDBACK_MESSAGE_ATTACHMENTS,
} from '../feedback-ticket.constants';
import { isValidFeedbackTicketTransition } from '../utils/feedback-ticket-transitions.util';
import { generateTicketCode } from '../utils/ticket-code.util';

type FeedbackMediaRecord = { media: Media };

type FeedbackMessageRecord = FeedbackMessage & {
  senderUser: Pick<User, 'displayName'> | null;
  media: FeedbackMediaRecord[];
};

type FeedbackTicketRecord = FeedbackTicket & {
  handledBy: Pick<User, 'displayName'> | null;
  media: FeedbackMediaRecord[];
  messages: FeedbackMessageRecord[];
};

type FeedbackTicketLookupRecord = FeedbackTicket & {
  channel: {
    id: string;
    title: string;
    category: FeedbackChannelCategory;
  } | null;
  media: FeedbackMediaRecord[];
  messages: FeedbackMessageRecord[];
};

const includeFeedbackMessages = {
  orderBy: [{ createdAt: Prisma.SortOrder.asc }, { id: Prisma.SortOrder.asc }],
  include: {
    senderUser: { select: { displayName: true } },
    media: {
      orderBy: { sortOrder: Prisma.SortOrder.asc },
      include: { media: true },
    },
  },
};

const includeFeedbackTicket = {
  handledBy: { select: { displayName: true } },
  media: {
    orderBy: { sortOrder: Prisma.SortOrder.asc },
    include: { media: true },
  },
  messages: includeFeedbackMessages,
};

function toAttachmentDtos(records: FeedbackMediaRecord[]): MediaResponseDto[] {
  return records.map((record) =>
    MediaResponseDto.fromEntity(new MediaEntity(record.media)),
  );
}

/** Strips incidental whitespace so "090 123 4567" matches "0901234567". */
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

const MAX_TICKET_CODE_ATTEMPTS = 5;

@Injectable()
export class FeedbackTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly realtime: FeedbackRealtimeGateway,
    private readonly notifications: NotificationService,
  ) {}

  /** Public, anonymous upload of a feedback-ticket attachment (image or video). */
  async uploadAttachment(buffer: Buffer): Promise<MediaResponseDto> {
    const media = await this.mediaService.uploadFeedbackAttachment({ buffer });
    return MediaResponseDto.fromEntity(media);
  }

  async submit(
    dto: SubmitFeedbackTicketDto,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    return this.submitInternal(dto);
  }

  async submitForUser(
    userId: string,
    dto: SubmitFeedbackTicketDto,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    return this.submitInternal(dto, userId);
  }

  async listMine(userId: string): Promise<FeedbackTicketLookupResponseDto[]> {
    const records = await this.prisma.feedbackTicket.findMany({
      where: { submittedById: userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        channel: { select: { id: true, title: true, category: true } },
        media: includeFeedbackTicket.media,
        messages: includeFeedbackMessages,
      },
    });
    return records.map((record) => this.toLookupDto(record));
  }

  private async submitInternal(
    dto: SubmitFeedbackTicketDto,
    submittedById?: string,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    if (dto.channelId) {
      const channel = await this.prisma.feedbackChannel.findUnique({
        where: { id: dto.channelId },
        select: { id: true },
      });
      if (!channel) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'channelId không tồn tại',
        );
      }
    }

    const mediaIds = dto.mediaIds ?? [];
    if (mediaIds.length > MAX_FEEDBACK_ATTACHMENTS) {
      throw new AppException(
        ErrorCode.UPLOAD_LIMIT_EXCEEDED,
        `Tối đa ${MAX_FEEDBACK_ATTACHMENTS} ảnh/video cho mỗi phản hồi`,
        HttpStatus.BAD_REQUEST,
      );
    }

    for (let attempt = 0; attempt < MAX_TICKET_CODE_ATTEMPTS; attempt++) {
      const ticketCode = generateTicketCode();
      try {
        const submitted = await this.prisma.$transaction(async (tx) => {
          const created = await tx.feedbackTicket.create({
            data: {
              ticketCode,
              channelId: dto.channelId ?? null,
              fullName: dto.fullName,
              phone: dto.phone,
              content: dto.content,
              status: FeedbackTicketStatus.NEW,
              submittedById: submittedById ?? null,
            },
          });

          const initialMessage = await tx.feedbackMessage.create({
            data: {
              ticketId: created.id,
              senderRole: FeedbackMessageSenderRole.USER,
              senderUserId: submittedById ?? null,
              content: dto.content,
            },
          });

          if (mediaIds.length > 0) {
            const media = await tx.media.findMany({
              where: {
                id: { in: mediaIds },
                deletedAt: null,
                resourceType: null,
                ...(submittedById
                  ? {
                      OR: [{ ownerId: null }, { ownerId: submittedById }],
                    }
                  : { ownerId: null }),
              },
              select: { id: true, mimeType: true },
            });
            if (
              media.length !== mediaIds.length ||
              media.some(
                (item) =>
                  !item.mimeType.startsWith('image/') &&
                  !item.mimeType.startsWith('video/'),
              )
            ) {
              throw this.invalidAttachment();
            }

            // Only claims media that are still unclaimed — if a concurrent
            // submit already claimed one of these ids, `claimed.count` comes
            // up short and the whole transaction (including the ticket row
            // just created) rolls back rather than leaving a media row
            // attached to two tickets.
            const claimed = await tx.media.updateMany({
              where: {
                id: { in: mediaIds },
                deletedAt: null,
                resourceType: null,
                ...(submittedById
                  ? {
                      OR: [{ ownerId: null }, { ownerId: submittedById }],
                    }
                  : { ownerId: null }),
              },
              data: {
                resourceType: MediaResourceType.FEEDBACK_TICKET,
                resourceId: created.id,
              },
            });
            if (claimed.count !== mediaIds.length) {
              throw this.invalidAttachment();
            }
            await tx.feedbackTicketMedia.createMany({
              data: mediaIds.map((mediaId, index) => ({
                ticketId: created.id,
                mediaId,
                sortOrder: index,
              })),
            });
            await tx.feedbackMessageMedia.createMany({
              data: mediaIds.map((mediaId, index) => ({
                messageId: initialMessage.id,
                mediaId,
                sortOrder: index,
              })),
            });
          }
          return {
            ticketId: created.id,
            ticketCode: created.ticketCode,
            messageId: initialMessage.id,
          };
        });
        await this.notifyFeedbackMessage({
          ...submitted,
          submittedById: submittedById ?? null,
          handledById: null,
          senderRole: FeedbackMessageSenderRole.USER,
          senderUserId: submittedById,
          senderName: dto.fullName,
          content: dto.content,
          attachmentCount: mediaIds.length,
        });
        return { success: true, ticketCode };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Không thể tạo mã ticket, vui lòng thử lại',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async lookup(
    dto: LookupFeedbackTicketDto,
  ): Promise<FeedbackTicketLookupResponseDto> {
    const record = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: dto.ticketCode.trim().toUpperCase() },
      include: {
        channel: { select: { id: true, title: true, category: true } },
        media: includeFeedbackTicket.media,
        messages: includeFeedbackMessages,
      },
    });
    // Same 404 whether the code doesn't exist or the phone doesn't match it,
    // so a guessed ticketCode can't be used to probe for its owner's phone.
    if (!record || normalizePhone(record.phone) !== normalizePhone(dto.phone)) {
      throw this.notFound();
    }
    return this.toLookupDto(record);
  }

  async replyAnonymous(
    ticketCode: string,
    dto: ReplyAnonymousFeedbackTicketDto,
  ): Promise<FeedbackMessageResponseDto> {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: ticketCode.trim().toUpperCase() },
      select: { id: true, phone: true },
    });
    if (!ticket || normalizePhone(ticket.phone) !== normalizePhone(dto.phone)) {
      throw this.notFound();
    }
    return this.createMessage({
      ticketId: ticket.id,
      senderRole: FeedbackMessageSenderRole.USER,
      dto,
    });
  }

  async replyAsUser(
    userId: string,
    ticketCode: string,
    dto: ReplyFeedbackTicketDto,
  ): Promise<FeedbackMessageResponseDto> {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: {
        ticketCode: ticketCode.trim().toUpperCase(),
        submittedById: userId,
      },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.createMessage({
      ticketId: ticket.id,
      senderRole: FeedbackMessageSenderRole.USER,
      senderUserId: userId,
      dto,
    });
  }

  async listMessagesAsUser(
    userId: string,
    ticketId: string,
  ): Promise<FeedbackMessageResponseDto[]> {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: { id: ticketId, submittedById: userId },
      select: {
        fullName: true,
        messages: includeFeedbackMessages,
      },
    });
    if (!ticket) throw this.notFound();
    return ticket.messages.map((message) =>
      this.toMessageDto(message, ticket.fullName),
    );
  }

  async replyAsUserById(
    userId: string,
    ticketId: string,
    dto: ReplyFeedbackTicketDto,
  ): Promise<FeedbackMessageResponseDto> {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: { id: ticketId, submittedById: userId },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.createMessage({
      ticketId: ticket.id,
      senderRole: FeedbackMessageSenderRole.USER,
      senderUserId: userId,
      dto,
    });
  }

  async replyAsAdmin(
    actorId: string,
    ticketId: string,
    dto: ReplyFeedbackTicketDto,
  ): Promise<FeedbackMessageResponseDto> {
    const exists = await this.prisma.feedbackTicket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!exists) throw this.notFound();
    return this.createMessage({
      ticketId,
      senderRole: FeedbackMessageSenderRole.ADMIN,
      senderUserId: actorId,
      dto,
    });
  }

  async adminList(query: QueryFeedbackTicketAdminDto) {
    const searchUpper = query.search?.toUpperCase();
    const where: Prisma.FeedbackTicketWhereInput = {
      ...(query.status
        ? { status: FEEDBACK_TICKET_STATUS_TO_DB[query.status] }
        : {}),
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { ticketCode: { contains: searchUpper } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.feedbackTicket.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: includeFeedbackTicket,
      }),
      this.prisma.feedbackTicket.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<FeedbackTicketAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateFeedbackTicketStatusDto,
  ): Promise<FeedbackTicketAdminResponseDto> {
    const current = await this.findOrThrow(id);
    const targetStatus = FEEDBACK_TICKET_STATUS_TO_DB[dto.status];
    const statusChanged = current.status !== targetStatus;
    if (
      statusChanged &&
      !isValidFeedbackTicketTransition(current.status, targetStatus)
    ) {
      throw new AppException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Không thể chuyển trạng thái từ ${FEEDBACK_TICKET_STATUS_FROM_DB[current.status]} sang ${dto.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feedbackTicket.update({
        where: { id },
        data: {
          status: targetStatus,
          adminNote: dto.adminNote ?? current.adminNote,
          handledById: actorId,
          ...(statusChanged && targetStatus === FeedbackTicketStatus.RESOLVED
            ? { resolvedAt: new Date() }
            : {}),
        },
        include: includeFeedbackTicket,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FEEDBACK_TICKET_STATUS_UPDATED',
          resourceType: 'FeedbackTicket',
          resourceId: id,
          oldData: { status: current.status },
          newData: {
            status: targetStatus,
            adminNote: dto.adminNote ?? current.adminNote,
          },
        },
      });
      return updated;
    });
    this.realtime.ticketStatusChanged(
      id,
      FEEDBACK_TICKET_STATUS_FROM_DB[record.status],
    );
    return this.toAdminDto(record);
  }

  private async createMessage(input: {
    ticketId: string;
    senderRole: FeedbackMessageSenderRole;
    senderUserId?: string;
    dto: ReplyFeedbackTicketDto;
  }): Promise<FeedbackMessageResponseDto> {
    const content = input.dto.content?.trim() ?? '';
    const mediaIds = input.dto.mediaIds ?? [];
    if (!content && mediaIds.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Tin nhắn phải có nội dung hoặc ít nhất một ảnh',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (mediaIds.length > MAX_FEEDBACK_MESSAGE_ATTACHMENTS) {
      throw new AppException(
        ErrorCode.UPLOAD_LIMIT_EXCEEDED,
        `Tối đa ${MAX_FEEDBACK_MESSAGE_ATTACHMENTS} ảnh cho mỗi tin nhắn`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.feedbackTicket.findUnique({
        where: { id: input.ticketId },
        select: {
          id: true,
          ticketCode: true,
          fullName: true,
          status: true,
          submittedById: true,
          handledById: true,
        },
      });
      if (!ticket) throw this.notFound();
      if (ticket.status === FeedbackTicketStatus.CLOSED) {
        throw new AppException(
          ErrorCode.FEEDBACK_CONVERSATION_CLOSED,
          'Hộp thư phản hồi đã đóng',
          HttpStatus.CONFLICT,
        );
      }

      if (mediaIds.length > 0) {
        const media = await tx.media.findMany({
          where: {
            id: { in: mediaIds },
            deletedAt: null,
            resourceType: null,
            ...(input.senderUserId
              ? {
                  OR: [{ ownerId: null }, { ownerId: input.senderUserId }],
                }
              : { ownerId: null }),
          },
          select: { id: true, mimeType: true },
        });
        if (
          media.length !== mediaIds.length ||
          media.some((item) => !item.mimeType.startsWith('image/'))
        ) {
          throw this.invalidAttachment();
        }
      }

      const message = await tx.feedbackMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: input.senderRole,
          senderUserId: input.senderUserId ?? null,
          content,
        },
      });

      if (mediaIds.length > 0) {
        const claimed = await tx.media.updateMany({
          where: {
            id: { in: mediaIds },
            deletedAt: null,
            resourceType: null,
            ...(input.senderUserId
              ? {
                  OR: [{ ownerId: null }, { ownerId: input.senderUserId }],
                }
              : { ownerId: null }),
          },
          data: {
            resourceType: MediaResourceType.FEEDBACK_TICKET,
            resourceId: ticket.id,
          },
        });
        if (claimed.count !== mediaIds.length) {
          throw this.invalidAttachment();
        }
        await tx.feedbackMessageMedia.createMany({
          data: mediaIds.map((mediaId, index) => ({
            messageId: message.id,
            mediaId,
            sortOrder: index,
          })),
        });
      }

      const adminStartedHandling =
        input.senderRole === FeedbackMessageSenderRole.ADMIN &&
        ticket.status === FeedbackTicketStatus.NEW;
      await tx.feedbackTicket.update({
        where: { id: ticket.id },
        data: {
          updatedAt: new Date(),
          ...(adminStartedHandling
            ? {
                status: FeedbackTicketStatus.IN_PROGRESS,
                handledById: input.senderUserId,
              }
            : {}),
        },
      });

      if (
        input.senderRole === FeedbackMessageSenderRole.ADMIN &&
        input.senderUserId
      ) {
        await tx.auditLog.create({
          data: {
            actorId: input.senderUserId,
            action: 'FEEDBACK_TICKET_REPLIED',
            resourceType: 'FeedbackTicket',
            resourceId: ticket.id,
            newData: {
              messageId: message.id,
              attachmentCount: mediaIds.length,
            },
          },
        });
      }

      const created = await tx.feedbackMessage.findUniqueOrThrow({
        where: { id: message.id },
        include: includeFeedbackMessages.include,
      });
      return {
        created,
        fullName: ticket.fullName,
        ticketCode: ticket.ticketCode,
        submittedById: ticket.submittedById,
        handledById: ticket.handledById,
      };
    });

    const messageDto = this.toMessageDto(result.created, result.fullName);
    this.realtime.messageCreated(
      input.ticketId,
      messageDto,
      input.senderRole === FeedbackMessageSenderRole.ADMIN ? 'admin' : 'user',
    );
    await this.notifyFeedbackMessage({
      ticketId: input.ticketId,
      ticketCode: result.ticketCode,
      messageId: result.created.id,
      submittedById: result.submittedById,
      handledById: result.handledById,
      senderRole: input.senderRole,
      senderUserId: input.senderUserId,
      senderName: messageDto.senderName,
      content: messageDto.content,
      attachmentCount: messageDto.attachments.length,
    });
    return messageDto;
  }

  private async notifyFeedbackMessage(input: {
    ticketId: string;
    ticketCode: string;
    messageId: string;
    submittedById: string | null;
    handledById: string | null;
    senderRole: FeedbackMessageSenderRole;
    senderUserId?: string;
    senderName: string;
    content: string;
    attachmentCount: number;
  }): Promise<void> {
    const body = input.content.trim()
      ? excerpt(input.content, 160)
      : input.attachmentCount === 1
        ? 'Đã gửi một hình ảnh.'
        : `Đã gửi ${input.attachmentCount} hình ảnh.`;
    const notification = {
      type: NotificationType.FEEDBACK_MESSAGE_RECEIVED,
      title:
        input.senderRole === FeedbackMessageSenderRole.ADMIN
          ? 'Hộp thư phản hồi có tin nhắn mới'
          : `Tin nhắn phản hồi từ ${input.senderName}`,
      body,
      data: {
        feedbackTicketId: input.ticketId,
        feedbackMessageId: input.messageId,
        ticketCode: input.ticketCode,
      },
    };

    if (input.senderRole === FeedbackMessageSenderRole.ADMIN) {
      if (input.submittedById !== input.senderUserId) {
        await this.notifications.notify(input.submittedById, notification);
      }
      return;
    }

    if (input.handledById && input.handledById !== input.senderUserId) {
      await this.notifications.notify(input.handledById, notification);
      return;
    }
    await this.notifications.notifyStaff(
      notification,
      input.senderUserId ? [input.senderUserId] : [],
    );
  }

  /** Issue short-lived WebSocket join credentials after the same access checks as REST. */
  async socketTokenAnonymous(ticketCode: string, phone: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: ticketCode.trim().toUpperCase() },
      select: { id: true, phone: true },
    });
    if (!ticket || normalizePhone(ticket.phone) !== normalizePhone(phone))
      throw this.notFound();
    return this.realtime.createTicketToken(ticket.id, 'user');
  }

  async socketTokenMine(userId: string, ticketCode: string) {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: {
        submittedById: userId,
        ticketCode: ticketCode.trim().toUpperCase(),
      },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.realtime.createTicketToken(ticket.id, 'user');
  }

  async socketTokenAdmin(ticketId: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.realtime.createTicketToken(ticket.id, 'admin');
  }

  /** Shared admin inbox read marker; anonymous senders authenticate by code + phone. */
  async markRead(ticketId: string, reader: 'user' | 'admin') {
    const at = new Date();
    await this.prisma.feedbackTicketReadState.upsert({
      where: { ticketId_reader: { ticketId, reader } },
      create: { ticketId, reader, lastReadAt: at },
      update: { lastReadAt: at },
    });
    this.realtime.markedRead(ticketId, reader, at);
    return { success: true, readAt: at };
  }

  async markReadAnonymous(ticketCode: string, phone: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: ticketCode.trim().toUpperCase() },
      select: { id: true, phone: true },
    });
    if (!ticket || normalizePhone(ticket.phone) !== normalizePhone(phone))
      throw this.notFound();
    return this.markRead(ticket.id, 'user');
  }

  async markReadMine(userId: string, ticketCode: string) {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: {
        ticketCode: ticketCode.trim().toUpperCase(),
        submittedById: userId,
      },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.markRead(ticket.id, 'user');
  }

  async markReadMineById(userId: string, ticketId: string) {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: { id: ticketId, submittedById: userId },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.markRead(ticket.id, 'user');
  }

  async markReadAdmin(id: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.markRead(ticket.id, 'admin');
  }

  async unreadCount(
    ticketId: string,
    reader: 'user' | 'admin',
  ): Promise<{ count: number }> {
    const state = await this.prisma.feedbackTicketReadState.findUnique({
      where: { ticketId_reader: { ticketId, reader } },
    });
    const count = await this.prisma.feedbackMessage.count({
      where: {
        ticketId,
        senderRole:
          reader === 'admin'
            ? FeedbackMessageSenderRole.USER
            : FeedbackMessageSenderRole.ADMIN,
        ...(state ? { createdAt: { gt: state.lastReadAt } } : {}),
      },
    });
    return { count };
  }

  async unreadAnonymous(ticketCode: string, phone: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { ticketCode: ticketCode.trim().toUpperCase() },
      select: { id: true, phone: true },
    });
    if (!ticket || normalizePhone(ticket.phone) !== normalizePhone(phone))
      throw this.notFound();
    return this.unreadCount(ticket.id, 'user');
  }

  async unreadMine(userId: string, ticketCode: string) {
    const ticket = await this.prisma.feedbackTicket.findFirst({
      where: {
        ticketCode: ticketCode.trim().toUpperCase(),
        submittedById: userId,
      },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.unreadCount(ticket.id, 'user');
  }

  async unreadAdmin(id: string) {
    const ticket = await this.prisma.feedbackTicket.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!ticket) throw this.notFound();
    return this.unreadCount(ticket.id, 'admin');
  }

  private async findOrThrow(id: string): Promise<FeedbackTicketRecord> {
    const record = await this.prisma.feedbackTicket.findUnique({
      where: { id },
      include: includeFeedbackTicket,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toLookupDto(
    record: FeedbackTicketLookupRecord,
  ): FeedbackTicketLookupResponseDto {
    return {
      id: record.id,
      ticketCode: record.ticketCode,
      status: FEEDBACK_TICKET_STATUS_FROM_DB[record.status],
      channel: record.channel
        ? {
            id: record.channel.id,
            title: record.channel.title,
            category:
              FEEDBACK_CHANNEL_CATEGORY_FROM_DB[record.channel.category],
          }
        : null,
      content: record.content,
      attachments: toAttachmentDtos(record.media),
      messages: record.messages.map((message) =>
        this.toMessageDto(message, record.fullName),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
    };
  }

  private toAdminDto(
    record: FeedbackTicketRecord,
  ): FeedbackTicketAdminResponseDto {
    return {
      id: record.id,
      ticketCode: record.ticketCode,
      channelId: record.channelId,
      fullName: record.fullName,
      phone: record.phone,
      content: record.content,
      status: FEEDBACK_TICKET_STATUS_FROM_DB[record.status],
      adminNote: record.adminNote,
      handledBy: record.handledBy?.displayName ?? null,
      attachments: toAttachmentDtos(record.media),
      messages: record.messages.map((message) =>
        this.toMessageDto(message, record.fullName),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
    };
  }

  private toMessageDto(
    message: FeedbackMessageRecord,
    ticketFullName: string,
  ): FeedbackMessageResponseDto {
    const isAdmin = message.senderRole === FeedbackMessageSenderRole.ADMIN;
    return {
      id: message.id,
      senderRole: isAdmin ? 'admin' : 'user',
      senderName: isAdmin
        ? (message.senderUser?.displayName ?? 'Quản trị viên')
        : (message.senderUser?.displayName ?? ticketFullName),
      content: message.content,
      attachments: toAttachmentDtos(message.media),
      createdAt: message.createdAt,
    };
  }

  private invalidAttachment(): AppException {
    return new AppException(
      ErrorCode.INVALID_FEEDBACK_ATTACHMENT,
      'Một hoặc nhiều tệp đính kèm không hợp lệ hoặc đã được sử dụng, vui lòng tải lên lại',
      HttpStatus.BAD_REQUEST,
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.FEEDBACK_TICKET_NOT_FOUND,
      'Không tìm thấy ticket phản hồi',
      HttpStatus.NOT_FOUND,
    );
  }
}
