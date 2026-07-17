import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CUISINE_CATEGORIES,
  type CuisineCategoryLabel,
} from '../cuisine.constants';
import { IsGoogleMapsUrl } from '../utils/google-maps-url.util';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((item) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class CuisineSuggestedPlaceDto {
  @ApiProperty({ maxLength: 100, example: 'cho-thu-dau-mot' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id: string;

  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    maxLength: 2048,
    example: 'https://maps.app.goo.gl/example',
    description:
      'Link Google Maps do Admin dán (không phải tọa độ). Rỗng nghĩa là chưa có, nhưng bắt buộc hợp lệ khi món được bật hiển thị.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  @IsGoogleMapsUrl()
  googleMapsUrl?: string;
}

export class CuisineContentDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: CUISINE_CATEGORIES })
  @IsIn(CUISINE_CATEGORIES)
  category: CuisineCategoryLabel;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  priceRange: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  bestTime: string;

  @ApiPropertyOptional({ type: [CuisineSuggestedPlaceDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CuisineSuggestedPlaceDto)
  suggestedPlaceDetails?: CuisineSuggestedPlaceDto[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    deprecated: true,
    description:
      'Deprecated — dùng suggestedPlaceDetails. Chỉ giữ để tương thích client cũ, sẽ bỏ ở API version sau.',
  })
  @IsOptional()
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  suggestedPlaces?: string[];

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
  description: string[];

  @ApiProperty({ type: [String], maxItems: 20 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  highlights: string[];

  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  tip: string;

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

export class CreateCuisineItemDto extends CuisineContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateCuisineItemDto extends CuisineContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
