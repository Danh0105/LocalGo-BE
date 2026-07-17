import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FEEDBACK_TICKET_STATUSES,
  type FeedbackTicketStatusLabel,
} from '../feedback-ticket.constants';

export class QueryFeedbackTicketAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FEEDBACK_TICKET_STATUSES })
  @IsOptional()
  @IsIn(FEEDBACK_TICKET_STATUSES)
  status?: FeedbackTicketStatusLabel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  channelId?: string;

  @ApiPropertyOptional({
    description: 'Tìm theo fullName, phone hoặc ticketCode',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'ISO 8601, mốc bắt đầu createdAt' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'ISO 8601, mốc kết thúc createdAt' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
