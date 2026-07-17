import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TEMPLE_TYPES, type TempleTypeLabel } from '../temple.constants';

export class QueryTemplePublicDto {
  @ApiPropertyOptional({ enum: TEMPLE_TYPES })
  @IsOptional()
  @IsIn(TEMPLE_TYPES)
  type?: TempleTypeLabel;
}

export class QueryTempleAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TEMPLE_TYPES })
  @IsOptional()
  @IsIn(TEMPLE_TYPES)
  type?: TempleTypeLabel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
