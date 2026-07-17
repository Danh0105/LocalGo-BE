import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  EXPERIENCE_TOUR_CATEGORIES,
  type ExperienceTourCategoryLabel,
} from '../experience-tour.constants';

export class QueryExperienceTourPublicDto {
  @ApiPropertyOptional({ enum: EXPERIENCE_TOUR_CATEGORIES })
  @IsOptional()
  @IsIn(EXPERIENCE_TOUR_CATEGORIES)
  category?: ExperienceTourCategoryLabel;
}

export class QueryExperienceTourAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EXPERIENCE_TOUR_CATEGORIES })
  @IsOptional()
  @IsIn(EXPERIENCE_TOUR_CATEGORIES)
  category?: ExperienceTourCategoryLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
