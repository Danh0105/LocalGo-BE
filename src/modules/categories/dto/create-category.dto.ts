import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { CATEGORY_DOMAINS } from '../categories.constants';

export class CreateCategoryDto {
  @ApiProperty({ enum: CATEGORY_DOMAINS })
  @IsIn(CATEGORY_DOMAINS)
  domain: string;

  @ApiProperty({ example: 'cay-trong-chu-luc' })
  @IsString()
  @Length(1, 120)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug phải là chữ thường, số và dấu gạch ngang',
  })
  slug: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
