import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../trade-post-category.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeTradePostCategoryCode(value) : value;
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export class CreateTradePostCategoryDto {
  @ApiProperty({
    example: 'PRODUCT',
    description:
      'Public stable identifier. Uppercase letters, digits and underscore only.',
  })
  @Transform(normalizeCode)
  @IsString()
  @Matches(TRADE_POST_CATEGORY_CODE_PATTERN)
  code: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPromotionDetails?: boolean;
}

export class UpdateTradePostCategoryDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty()
  @IsBoolean()
  requiresPromotionDetails: boolean;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
