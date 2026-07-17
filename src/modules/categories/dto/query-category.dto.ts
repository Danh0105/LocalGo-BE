import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CATEGORY_DOMAINS } from '../categories.constants';

export class QueryCategoryDto {
  @ApiPropertyOptional({ enum: CATEGORY_DOMAINS })
  @IsOptional()
  @IsIn(CATEGORY_DOMAINS)
  domain?: string;
}
