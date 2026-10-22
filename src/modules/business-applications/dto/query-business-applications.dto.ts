import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessType,
} from '../../../../generated/prisma';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryBusinessApplicationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BusinessApplicationStatus })
  @IsOptional()
  @IsEnum(BusinessApplicationStatus)
  status?: BusinessApplicationStatus;

  @ApiPropertyOptional({ enum: BusinessApplicantType })
  @IsOptional()
  @IsEnum(BusinessApplicantType)
  applicantType?: BusinessApplicantType;

  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
