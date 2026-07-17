import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CUISINE_CATEGORIES,
  type CuisineCategoryLabel,
} from '../cuisine.constants';

export class QueryCuisinePublicDto {
  @ApiPropertyOptional({ enum: CUISINE_CATEGORIES })
  @IsOptional()
  @IsIn(CUISINE_CATEGORIES)
  category?: CuisineCategoryLabel;
}

export class QueryCuisineAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CUISINE_CATEGORIES })
  @IsOptional()
  @IsIn(CUISINE_CATEGORIES)
  category?: CuisineCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
