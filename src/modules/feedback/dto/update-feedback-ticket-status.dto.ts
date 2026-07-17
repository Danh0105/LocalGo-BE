import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FEEDBACK_TICKET_STATUSES,
  type FeedbackTicketStatusLabel,
} from '../feedback-ticket.constants';

export class UpdateFeedbackTicketStatusDto {
  @ApiProperty({ enum: FEEDBACK_TICKET_STATUSES })
  @IsIn(FEEDBACK_TICKET_STATUSES)
  status: FeedbackTicketStatusLabel;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
