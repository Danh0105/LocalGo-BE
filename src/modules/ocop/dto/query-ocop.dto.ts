import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  OCOP_CATEGORIES,
  OCOP_RATINGS,
  type OcopCategoryLabel,
  type OcopRatingValue,
} from '../ocop.constants';

export class QueryOcopPublicDto {
  @ApiPropertyOptional({ enum: OCOP_CATEGORIES })
  @IsOptional()
  @IsIn(OCOP_CATEGORIES)
  category?: OcopCategoryLabel;

  @ApiPropertyOptional({ enum: OCOP_RATINGS })
  @IsOptional()
  @Type(() => Number)
  @IsIn(OCOP_RATINGS)
  rating?: OcopRatingValue;
}

export class QueryOcopAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OCOP_CATEGORIES })
  @IsOptional()
  @IsIn(OCOP_CATEGORIES)
  category?: OcopCategoryLabel;

  @ApiPropertyOptional({ enum: OCOP_RATINGS })
  @IsOptional()
  @Type(() => Number)
  @IsIn(OCOP_RATINGS)
  rating?: OcopRatingValue;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
