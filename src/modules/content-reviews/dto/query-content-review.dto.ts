import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentReviewStatus } from '../../../../generated/prisma';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CONTENT_REVIEW_TARGET_TYPES,
  MAX_CONTENT_REVIEW_RATING_IDS,
  type ContentReviewTargetTypeName,
} from '../content-review.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryContentReviewRatingsDto {
  @ApiProperty({ enum: CONTENT_REVIEW_TARGET_TYPES })
  @IsIn(CONTENT_REVIEW_TARGET_TYPES)
  targetType: ContentReviewTargetTypeName;

  @ApiPropertyOptional({
    description: `Danh sách id cách nhau bởi dấu phẩy (tối đa ${MAX_CONTENT_REVIEW_RATING_IDS}). Bỏ trống để lấy mọi mục đã có đánh giá.`,
    example: 'chua-ba-thien-hau,dinh-truong-mit',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(MAX_CONTENT_REVIEW_RATING_IDS)
  @IsString({ each: true })
  @MaxLength(191, { each: true })
  ids?: string[];
}

export class QueryContentReviewAdminStatsDto {
  @ApiPropertyOptional({ enum: CONTENT_REVIEW_TARGET_TYPES })
  @IsOptional()
  @IsIn(CONTENT_REVIEW_TARGET_TYPES)
  targetType?: ContentReviewTargetTypeName;

  @ApiPropertyOptional({
    description: 'Id (slug) của mục, dùng kèm targetType',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  targetId?: string;
}

export class QueryContentReviewAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_REVIEW_TARGET_TYPES })
  @IsOptional()
  @IsIn(CONTENT_REVIEW_TARGET_TYPES)
  targetType?: ContentReviewTargetTypeName;

  @ApiPropertyOptional({
    description: 'Id (slug) của mục, dùng kèm targetType',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  targetId?: string;

  @ApiPropertyOptional({ enum: ContentReviewStatus })
  @IsOptional()
  @IsEnum(ContentReviewStatus)
  status?: ContentReviewStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Tìm theo nội dung bình luận hoặc tên người đánh giá',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
