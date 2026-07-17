import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  TradePostCategory,
  TradePostStatus,
} from '../../../../../generated/prisma';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { TRADE_POST_SORT_OPTIONS } from '../../trade.constants';

export class QueryTradePostDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TradePostCategory })
  @IsOptional()
  @IsEnum(TradePostCategory)
  category?: TradePostCategory;

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
