import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { TradePostStatus } from '../../../../../generated/prisma';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../../categories/trade-post-category.constants';
import { TRADE_POST_SORT_OPTIONS } from '../../trade.constants';

export class QueryTradePostDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'PRODUCT',
    description:
      'Mã danh mục ổn định. Public list trả TRADE_POST_CATEGORY_INVALID nếu code không tồn tại hoặc inactive.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTradePostCategoryCode(value) : value,
  )
  @IsString()
  @Matches(TRADE_POST_CATEGORY_CODE_PATTERN)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ enum: TRADE_POST_SORT_OPTIONS, default: 'newest' })
  @IsOptional()
  @IsIn(TRADE_POST_SORT_OPTIONS)
  sortBy?: (typeof TRADE_POST_SORT_OPTIONS)[number] = 'newest';

  /** Admin-only filter; ignored by the public controller regardless of what's sent. */
  @ApiPropertyOptional({ enum: TradePostStatus })
  @IsOptional()
  @IsEnum(TradePostStatus)
  status?: TradePostStatus;
}
