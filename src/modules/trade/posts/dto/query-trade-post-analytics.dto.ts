import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../../categories/trade-post-category.constants';

/**
 * Date range + optional scope for trade-post analytics. `to` is an exclusive
 * upper bound; both default (server-side) to the last 30 days when omitted.
 */
export class QueryTradePostAnalyticsDto {
  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Mốc bắt đầu (ISO 8601). Mặc định: 30 ngày trước.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Mốc kết thúc (ISO 8601, loại trừ). Mặc định: hiện tại.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: '[Admin] Lọc theo chủ tin (userId).',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    example: 'PRODUCT',
    description: '[Admin] Lọc theo mã danh mục.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTradePostCategoryCode(value) : value,
  )
  @IsString()
  @Matches(TRADE_POST_CATEGORY_CODE_PATTERN)
  category?: string;
}
