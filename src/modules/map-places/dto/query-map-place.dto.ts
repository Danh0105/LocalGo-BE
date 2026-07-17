import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  MAP_PLACE_CATEGORIES,
  type MapPlaceCategoryLabel,
} from '../map-place.constants';

export class QueryMapPlacePublicDto {
  @ApiPropertyOptional({ enum: MAP_PLACE_CATEGORIES })
  @IsOptional()
  @IsIn(MAP_PLACE_CATEGORIES)
  category?: MapPlaceCategoryLabel;
}

export class QueryMapPlaceAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MAP_PLACE_CATEGORIES })
  @IsOptional()
  @IsIn(MAP_PLACE_CATEGORIES)
  category?: MapPlaceCategoryLabel;

  @ApiPropertyOptional({
    description: 'Tìm theo name hoặc address',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
