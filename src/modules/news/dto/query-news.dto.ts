import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { NEWS_CATEGORIES, type NewsCategoryLabel } from '../news.constants';

export class QueryNewsPublicDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NEWS_CATEGORIES })
  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: NewsCategoryLabel;
}

export class QueryNewsAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NEWS_CATEGORIES })
  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: NewsCategoryLabel;

  @ApiPropertyOptional({ description: 'Tìm theo title', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
