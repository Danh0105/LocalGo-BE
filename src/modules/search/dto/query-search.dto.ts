import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SEARCH_RESOURCE_TYPES,
  type SearchResourceType,
} from '../search.constants';

function parseSearchTypes(value: unknown): unknown[] {
  const values: unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : [value];
  const result: unknown[] = [];
  for (const item of values) {
    if (typeof item !== 'string') {
      result.push(item);
      continue;
    }
    for (const part of item.split(',')) {
      const normalized = part.trim().toUpperCase();
      if (normalized) result.push(normalized);
    }
  }
  return result;
}

export class QuerySearchDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 100,
    example: 'mang cau',
    description: 'Không phân biệt hoa/thường và dấu tiếng Việt',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;

  @ApiPropertyOptional({
    enum: SEARCH_RESOURCE_TYPES,
    isArray: true,
    description:
      'Danh sách nhóm cách nhau bởi dấu phẩy. Bỏ trống để tìm trong mọi nhóm.',
    example: 'SPECIALTY,OCOP,TRADE_POST',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseSearchTypes(value))
  @IsArray()
  @ArrayMaxSize(SEARCH_RESOURCE_TYPES.length)
  @IsIn(SEARCH_RESOURCE_TYPES, { each: true })
  types?: SearchResourceType[];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
