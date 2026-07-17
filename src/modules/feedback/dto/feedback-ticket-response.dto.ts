import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class FeedbackTicketLookupResponseDto {
  @ApiProperty({ example: 'PH-A7K9QX' })
  ticketCode: string;

  @ApiProperty({ enum: FEEDBACK_TICKET_STATUSES })
  status: FeedbackTicketStatusLabel;

  @ApiPropertyOptional({ type: FeedbackTicketLookupChannelDto, nullable: true })
  channel: FeedbackTicketLookupChannelDto | null;

  @ApiProperty()
  content: string;

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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;
}
