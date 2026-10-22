import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { FEEDBACK_TICKET_STATUSES } from '../feedback-ticket.constants';
import type { FeedbackTicketStatusLabel } from '../feedback-ticket.constants';

export class SubmitFeedbackTicketResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 'PH-A7K9QX' })
  ticketCode: string;
}

export class FeedbackTicketLookupChannelDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  category: string;
}

export class FeedbackMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['user', 'admin'] })
  senderRole: 'user' | 'admin';

  @ApiProperty()
  senderName: string;

  @ApiProperty({ example: 'Cảm ơn, tôi xin bổ sung thêm thông tin.' })
  content: string;

  @ApiProperty({ type: [MediaResponseDto] })
  attachments: MediaResponseDto[];

  @ApiProperty()
  createdAt: Date;
}

export class FeedbackTicketLookupResponseDto {
  @ApiProperty({
    example: 'b39f86fe-8758-44ef-938b-f6fcbd8d01d4',
    description: 'ID nội bộ đã lưu của ticket, dùng cho các API hội thoại.',
  })
  id: string;

  @ApiProperty({ example: 'PH-A7K9QX' })
  ticketCode: string;

  @ApiProperty({ enum: FEEDBACK_TICKET_STATUSES })
  status: FeedbackTicketStatusLabel;

  @ApiPropertyOptional({ type: FeedbackTicketLookupChannelDto, nullable: true })
  channel: FeedbackTicketLookupChannelDto | null;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [MediaResponseDto] })
  attachments: MediaResponseDto[];

  @ApiProperty({ type: [FeedbackMessageResponseDto] })
  messages: FeedbackMessageResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;
}

export class FeedbackTicketAdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ticketCode: string;

  @ApiPropertyOptional({ nullable: true })
  channelId: string | null;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: FEEDBACK_TICKET_STATUSES })
  status: FeedbackTicketStatusLabel;

  @ApiPropertyOptional({ nullable: true })
  adminNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  handledBy: string | null;

  @ApiProperty({ type: [MediaResponseDto] })
  attachments: MediaResponseDto[];

  @ApiProperty({ type: [FeedbackMessageResponseDto] })
  messages: FeedbackMessageResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;
}
