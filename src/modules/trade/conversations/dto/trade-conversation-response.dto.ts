import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TradeMessage,
  TradePostStatus,
} from '../../../../../generated/prisma';
import type { TradeConversationRecord } from '../repositories/trade-conversation.repository';

export class TradeMessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() conversationId: string;
  @ApiProperty() senderId: string;
  @ApiProperty() content: string;
  @ApiPropertyOptional({ nullable: true }) readAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromRecord(message: TradeMessage): TradeMessageResponseDto {
    const dto = new TradeMessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.senderId = message.senderId;
    dto.content = message.content;
    dto.readAt = message.readAt;
    dto.createdAt = message.createdAt;
    return dto;
  }
}

export class TradeConversationPostDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING',
      'PUBLISHED',
      'HIDDEN',
      'REJECTED',
      'EXPIRED',
      'ARCHIVED',
    ],
  })
  status: TradePostStatus;
}

export class TradeConversationPartyDto {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
}

/** A thread as seen by one participant: `counterpart` is the other side. */
export class TradeConversationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() customerId: string;
  @ApiProperty() ownerId: string;
  @ApiProperty({ type: () => TradeConversationPostDto })
  tradePost: TradeConversationPostDto;
  @ApiProperty({ type: () => TradeConversationPartyDto })
  counterpart: TradeConversationPartyDto;
  @ApiPropertyOptional({ type: () => TradeMessageResponseDto, nullable: true })
  lastMessage: TradeMessageResponseDto | null;
  @ApiProperty({ description: 'Tin nhắn của đối phương chưa đọc' })
  unreadCount: number;
  @ApiProperty() lastMessageAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromRecord(
    record: TradeConversationRecord,
    viewerId: string,
    unreadCount: number,
  ): TradeConversationResponseDto {
    const dto = new TradeConversationResponseDto();
    dto.id = record.id;
    dto.customerId = record.customerId;
    dto.ownerId = record.ownerId;
    dto.tradePost = { ...record.tradePost };
    dto.counterpart = {
      ...(viewerId === record.customerId ? record.owner : record.customer),
    };
    dto.lastMessage = record.messages[0]
      ? TradeMessageResponseDto.fromRecord(record.messages[0])
      : null;
    dto.unreadCount = unreadCount;
    dto.lastMessageAt = record.lastMessageAt;
    dto.createdAt = record.createdAt;
    dto.updatedAt = record.updatedAt;
    return dto;
  }
}
