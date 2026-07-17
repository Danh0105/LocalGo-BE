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
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EXPERIENCE_TOUR_CATEGORIES,
  type ExperienceTourCategoryLabel,
} from '../experience-tour.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((item) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class ExperienceTourContentDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: EXPERIENCE_TOUR_CATEGORIES })
  @IsIn(EXPERIENCE_TOUR_CATEGORIES)
  category: ExperienceTourCategoryLabel;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  duration: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  startTime: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  priceRange: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  meetingPoint: string;

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

  @ApiProperty({
    type: [String],
    maxItems: 30,
    description:
      'Các bước lịch trình theo đúng thứ tự thực hiện; thứ tự trong mảng là thứ tự tuần tự của tour, không được sắp xếp lại tự động.',
  })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  itinerary: string[];

  @ApiProperty({ type: [String], maxItems: 20 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  included: string[];

  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note: string;

  @ApiProperty({
    maxLength: 30,
    description:
      'Số điện thoại liên hệ đặt tour. Chỉ chữ số, khoảng trắng và tối đa một dấu + ở đầu',
    example: '0900 123 456',
  })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'contactPhone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  contactPhone: string;

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

export class CreateExperienceTourDto extends ExperienceTourContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateExperienceTourDto extends ExperienceTourContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
