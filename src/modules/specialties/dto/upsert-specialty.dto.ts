import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
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
  SPECIALTY_CATEGORIES,
  type SpecialtyCategoryLabel,
} from '../specialty.constants';
import { IsGoogleMapsUrl } from '../../../common/validation/google-maps-url.validator';
import { MAX_CONTENT_GALLERY_IMAGES } from '../../media/media.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((item) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const result = value.trim();
  return result.length > 0 ? result : undefined;
};

/** Object địa điểm mới (buyPlaceDetails), bên cạnh buyPlaces string[] legacy. */
export class SpecialtyBuyPlaceDto {
  @ApiProperty({ maxLength: 100, example: 'cho-truong-mit' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id!: string;

  @ApiProperty({ maxLength: 200, example: 'Chợ Truông Mít' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    maxLength: 2048,
    example: 'https://maps.app.goo.gl/cho-truong-mit',
    description: 'Liên kết Google Maps của địa điểm; có thể bỏ trống.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsGoogleMapsUrl()
  googleMapsUrl?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    example: '0900 123 456',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone?: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'lienhe@example.com' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class SpecialtyContentDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: SPECIALTY_CATEGORIES })
  @IsIn(SPECIALTY_CATEGORIES)
  category!: SpecialtyCategoryLabel;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  price!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  season!: string;

  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  summary!: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(5000, { each: true })
  description!: string[];

  @ApiPropertyOptional({ type: [SpecialtyBuyPlaceDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SpecialtyBuyPlaceDto)
  buyPlaceDetails?: SpecialtyBuyPlaceDto[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    deprecated: true,
    description: 'Legacy string[]; client mới gửi buyPlaceDetails.',
  })
  @IsOptional()
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  buyPlaces?: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  mediaId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_CONTENT_GALLERY_IMAGES,
    description: 'ID các ảnh thư viện theo thứ tự hiển thị.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTENT_GALLERY_IMAGES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  galleryMediaIds?: string[];

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  imageAlt!: string;

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

export class CreateSpecialtyDto extends SpecialtyContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateSpecialtyDto extends SpecialtyContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}
