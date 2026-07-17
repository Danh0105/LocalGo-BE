import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AboutMediaRefDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mediaId?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  imageAlt: string;
}

export class AboutOverviewDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) title: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(5000, { each: true })
  paragraphs: string[];
}

export class AboutStatisticDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) value: string;
  @ApiProperty() @IsString() @MaxLength(30) unit: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) label: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder: number;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class AboutHighlightDto extends AboutMediaRefDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) title: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) description: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder: number;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class AboutMilestoneDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(30) year: string;
  @ApiProperty() @IsString() @MaxLength(150) title: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(5000) description: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder: number;
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class UpdateAboutDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) title: string;

  @ApiProperty({ type: AboutMediaRefDto })
  @ValidateNested()
  @Type(() => AboutMediaRefDto)
  hero: AboutMediaRefDto;

  @ApiProperty({ type: AboutOverviewDto })
  @ValidateNested()
  @Type(() => AboutOverviewDto)
  overview: AboutOverviewDto;

  @ApiProperty({ type: [AboutStatisticDto], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AboutStatisticDto)
  statistics: AboutStatisticDto[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  highlightsSectionTitle: string;

  @ApiProperty({ type: [AboutHighlightDto], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AboutHighlightDto)
  highlights: AboutHighlightDto[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  milestonesSectionTitle: string;

  @ApiProperty({ type: [AboutMilestoneDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AboutMilestoneDto)
  milestones: AboutMilestoneDto[];
}
