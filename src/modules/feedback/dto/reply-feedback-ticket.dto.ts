import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_FEEDBACK_MESSAGE_ATTACHMENTS } from '../feedback-ticket.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ReplyFeedbackTicketDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Có thể bỏ trống khi tin nhắn có ít nhất một ảnh.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: MAX_FEEDBACK_MESSAGE_ATTACHMENTS,
    description:
      'ID ảnh chưa được sử dụng. Tối đa 5 ảnh; tin nhắn không nhận video.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FEEDBACK_MESSAGE_ATTACHMENTS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}

export class ReplyAnonymousFeedbackTicketDto extends ReplyFeedbackTicketDto {
  @ApiProperty({ maxLength: 30 })
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone: string;
}

/**
 * Shared body for the backward-compatible message route. Authenticated
 * residents are identified by their bearer token and do not send a phone;
 * anonymous callers still have to send one.
 */
export class ReplyFeedbackTicketRouteDto extends ReplyFeedbackTicketDto {
  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone?: string;
}
