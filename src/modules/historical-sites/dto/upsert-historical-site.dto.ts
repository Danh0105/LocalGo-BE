import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  HISTORICAL_SITE_RANKS,
  type HistoricalSiteRankLabel,
} from '../historical-site.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((item) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class HistoricalSiteContentDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: HISTORICAL_SITE_RANKS })
  @IsIn(HISTORICAL_SITE_RANKS)
  rank: HistoricalSiteRankLabel;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address: string;

  @ApiPropertyOptional({ minimum: 1900, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  recognizedYear?: number | null;

  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  summary: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(5000, { each: true })
  history: string[];

  @ApiProperty({ type: [String], maxItems: 20 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  highlights: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mediaId?: string | null;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  imageAlt: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateHistoricalSiteDto extends HistoricalSiteContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateHistoricalSiteDto extends HistoricalSiteContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
