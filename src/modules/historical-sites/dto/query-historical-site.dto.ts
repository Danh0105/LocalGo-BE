import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  HISTORICAL_SITE_RANKS,
  type HistoricalSiteRankLabel,
} from '../historical-site.constants';

export class QueryHistoricalSitePublicDto {
  @ApiPropertyOptional({ enum: HISTORICAL_SITE_RANKS })
  @IsOptional()
  @IsIn(HISTORICAL_SITE_RANKS)
  rank?: HistoricalSiteRankLabel;
}

export class QueryHistoricalSiteAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HISTORICAL_SITE_RANKS })
  @IsOptional()
  @IsIn(HISTORICAL_SITE_RANKS)
  rank?: HistoricalSiteRankLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
