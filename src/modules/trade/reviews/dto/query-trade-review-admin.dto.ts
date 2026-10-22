import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TradeReviewStatus } from '../../../../../generated/prisma';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class QueryTradeReviewAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TradeReviewStatus })
  @IsOptional()
  @IsEnum(TradeReviewStatus)
  status?: TradeReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tradePostId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description:
      'Tìm theo nội dung đánh giá, tên người đánh giá hoặc tiêu đề tin giao thương',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class QueryTradeReviewAdminStatsDto {
  @ApiPropertyOptional({
    description: 'Chỉ đếm đánh giá của một tin giao thương',
  })
  @IsOptional()
  @IsUUID()
  tradePostId?: string;
}
