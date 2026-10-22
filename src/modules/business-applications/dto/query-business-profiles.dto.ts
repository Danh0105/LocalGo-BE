import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BusinessType } from '../../../../generated/prisma';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryBusinessProfilesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ description: 'Tìm theo tên, lĩnh vực hoặc địa chỉ.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class QueryAdminBusinessProfilesDto extends QueryBusinessProfilesDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  includeDeleted: boolean = false;
}
