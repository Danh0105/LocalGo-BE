import { HttpStatus, Injectable } from '@nestjs/common';
import type { TradeMessage } from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  NotificationSocketEvent,
  NotificationType,
  excerpt,
} from '../../../notifications/notification-types';
import { NotificationService } from '../../../notifications/services/notification.service';
import {
  TradeConversationResponseDto,
  TradeMessageResponseDto,
} from '../dto/trade-conversation-response.dto';
import { CreateTradeConversationDto } from '../dto/trade-conversation-input.dto';
import {
  TradeConversationRepository,
  type TradeConversationRecord,
} from '../repositories/trade-conversation.repository';

@Injectable()
export class TradeConversationService {
  constructor(
    private readonly repository: TradeConversationRepository,
    private readonly notifications: NotificationService,
  ) {}

  /** Customer opens (or reuses) the thread about a published post with a first message. */
  async open(
    user: AuthenticatedUser,
    dto: CreateTradeConversationDto,
  ): Promise<TradeConversationResponseDto> {
    const post = await this.repository.findChattablePost(dto.tradePostId);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng hoặc tin chưa được xuất bản',
        HttpStatus.NOT_FOUND,
      );
    }
    if (post.ownerId === user.id) {
      throw new AppException(
        ErrorCode.CANNOT_MESSAGE_OWN_POST,
        'Bạn không thể tự nhắn tin cho tin đăng của chính mình',
        HttpStatus.FORBIDDEN,
      );
    }

    const { conversationId, created, message } =
      await this.repository.openWithMessage({
        tradePostId: post.id,
        customerId: user.id,
        ownerId: post.ownerId,
        content: dto.message,
      });
    const conversation = await this.getForParticipantOrThrow(
      user,
      conversationId,
    );

    if (created) {
      await this.notifications.notify(post.ownerId, {
        type: NotificationType.TRADE_CONVERSATION_STARTED,
        title: 'Tin nhắn mới từ khách hàng',
        body: `${conversation.customer.displayName} hỏi về "${excerpt(conversation.tradePost.title, 80)}": ${excerpt(dto.message, 100)}`,
        data: {
          conversationId,
          tradePostId: post.id,
          slug: conversation.tradePost.slug,
        },
      });
    }
    this.pushMessage(post.ownerId, conversation, message);
    return this.toResponse(conversation, user.id);
  }

  async list(
    user: AuthenticatedUser,
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<TradeConversationResponseDto>> {
    const { skip, take } = buildPaginationArgs(page, limit);
    const { items, total } = await this.repository.findPageForParticipant({
      userId: user.id,
      skip,
      take,
    });
    const unread = await this.repository.countUnread(
      items.map((item) => item.id),
      user.id,
    );
    return paginate(
      items.map((item) =>
        TradeConversationResponseDto.fromRecord(
          item,
          user.id,
          unread.get(item.id) ?? 0,
        ),
      ),
      page,
      limit,
      total,
    );
  }

  /** Page 1 holds the newest messages; each page is ordered oldest-first. */
  async listMessages(
    user: AuthenticatedUser,
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<TradeMessageResponseDto>> {
    await this.getForParticipantOrThrow(user, conversationId);
    const { skip, take } = buildPaginationArgs(page, limit);
    const { items, total } = await this.repository.findMessagePage({
      conversationId,
      skip,
      take,
    });
    return paginate(
      items.map((item) => TradeMessageResponseDto.fromRecord(item)),
      page,
      limit,
      total,
    );
  }

  async send(
    user: AuthenticatedUser,
    conversationId: string,
    content: string,
  ): Promise<TradeMessageResponseDto> {
    const conversation = await this.getForParticipantOrThrow(
      user,
      conversationId,
    );
    const message = await this.repository.addMessage({
      conversationId,
      senderId: user.id,
      content,
    });
    const recipientId =
      conversation.customerId === user.id
        ? conversation.ownerId
        : conversation.customerId;
    this.pushMessage(recipientId, conversation, message);
    return TradeMessageResponseDto.fromRecord(message);
  }

  /** Live chat update for the other participant (socket only, no bell row). */
  private pushMessage(
    recipientId: string,
    conversation: TradeConversationRecord,
    message: TradeMessage,
  ): void {
    this.notifications.emit(recipientId, NotificationSocketEvent.CHAT_MESSAGE, {
      conversationId: conversation.id,
      tradePostId: conversation.tradePostId,
      message: TradeMessageResponseDto.fromRecord(message),
    });
  }

  /** Marks the other party's unread messages as read; never the caller's own. */
  async markRead(
    user: AuthenticatedUser,
    conversationId: string,
  ): Promise<void> {
    await this.getForParticipantOrThrow(user, conversationId);
    await this.repository.markReadFromOtherParty(conversationId, user.id);
  }

  private async toResponse(
    record: TradeConversationRecord,
    viewerId: string,
  ): Promise<TradeConversationResponseDto> {
    const unread = await this.repository.countUnread([record.id], viewerId);
    return TradeConversationResponseDto.fromRecord(
      record,
      viewerId,
      unread.get(record.id) ?? 0,
    );
  }

  /** Non-participants get 404, not 403, so thread ids can't be probed. */
  private async getForParticipantOrThrow(
    user: AuthenticatedUser,
    conversationId: string,
  ): Promise<TradeConversationRecord> {
    const conversation = await this.repository.findForParticipant(
      conversationId,
      user.id,
    );
    if (!conversation) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy hội thoại',
        HttpStatus.NOT_FOUND,
      );
    }
    return conversation;
  }
}
