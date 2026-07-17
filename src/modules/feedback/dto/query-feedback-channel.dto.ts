import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FEEDBACK_CHANNEL_CATEGORIES,
  type FeedbackChannelCategoryLabel,
} from '../feedback-channel.constants';

export class QueryFeedbackChannelPublicDto {
  @ApiPropertyOptional({ enum: FEEDBACK_CHANNEL_CATEGORIES })
  @IsOptional()
  @IsIn(FEEDBACK_CHANNEL_CATEGORIES)
  category?: FeedbackChannelCategoryLabel;
}

export class QueryFeedbackChannelAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FEEDBACK_CHANNEL_CATEGORIES })
  @IsOptional()
  @IsIn(FEEDBACK_CHANNEL_CATEGORIES)
  category?: FeedbackChannelCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
