import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FESTIVAL_CATEGORIES,
  type FestivalCategoryLabel,
} from '../festival.constants';

export class QueryFestivalPublicDto {
  @ApiPropertyOptional({ enum: FESTIVAL_CATEGORIES })
  @IsOptional()
  @IsIn(FESTIVAL_CATEGORIES)
  category?: FestivalCategoryLabel;
}

export class QueryFestivalAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FESTIVAL_CATEGORIES })
  @IsOptional()
  @IsIn(FESTIVAL_CATEGORIES)
  category?: FestivalCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
