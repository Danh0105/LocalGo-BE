import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  AGRICULTURE_CATEGORIES,
  type AgricultureCategoryLabel,
} from '../agriculture.constants';

export class QueryAgriculturePublicDto {
  @ApiPropertyOptional({ enum: AGRICULTURE_CATEGORIES })
  @IsOptional()
  @IsIn(AGRICULTURE_CATEGORIES)
  category?: AgricultureCategoryLabel;
}

export class QueryAgricultureAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AGRICULTURE_CATEGORIES })
  @IsOptional()
  @IsIn(AGRICULTURE_CATEGORIES)
  category?: AgricultureCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
