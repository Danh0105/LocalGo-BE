import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  CONTACT_CATEGORIES,
  type ContactCategoryLabel,
} from '../contact.constants';

export class QueryContactPublicDto {
  @ApiPropertyOptional({ enum: CONTACT_CATEGORIES })
  @IsOptional()
  @IsIn(CONTACT_CATEGORIES)
  category?: ContactCategoryLabel;
}

export class QueryContactAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTACT_CATEGORIES })
  @IsOptional()
  @IsIn(CONTACT_CATEGORIES)
  category?: ContactCategoryLabel;

  @ApiPropertyOptional({
    description: 'Tìm theo name hoặc phone',
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
