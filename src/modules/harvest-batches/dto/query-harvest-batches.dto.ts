import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class QueryHarvestBatchesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên trái cây hoặc mã lô.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Ngày cắt từ (YYYY-MM-DD).',
  })
  @IsOptional()
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Ngày cắt đến (YYYY-MM-DD).',
  })
  @IsOptional()
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  to?: string;
}
