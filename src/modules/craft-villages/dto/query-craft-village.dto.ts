import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CRAFT_VILLAGE_CATEGORIES,
  type CraftVillageCategoryLabel,
} from '../craft-village.constants';

export class QueryCraftVillagePublicDto {
  @ApiPropertyOptional({ enum: CRAFT_VILLAGE_CATEGORIES })
  @IsOptional()
  @IsIn(CRAFT_VILLAGE_CATEGORIES)
  category?: CraftVillageCategoryLabel;
}

export class QueryCraftVillageAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CRAFT_VILLAGE_CATEGORIES })
  @IsOptional()
  @IsIn(CRAFT_VILLAGE_CATEGORIES)
  category?: CraftVillageCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
