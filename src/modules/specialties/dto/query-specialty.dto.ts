import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  SPECIALTY_CATEGORIES,
  type SpecialtyCategoryLabel,
} from '../specialty.constants';

export class QuerySpecialtyPublicDto {
  @ApiPropertyOptional({ enum: SPECIALTY_CATEGORIES })
  @IsOptional()
  @IsIn(SPECIALTY_CATEGORIES)
  category?: SpecialtyCategoryLabel;
}

export class QuerySpecialtyAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SPECIALTY_CATEGORIES })
  @IsOptional()
  @IsIn(SPECIALTY_CATEGORIES)
  category?: SpecialtyCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
