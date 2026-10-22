import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
import { NEWS_CATEGORIES, type NewsCategoryLabel } from '../news.constants';
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

export class NewsArticleContentDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: NEWS_CATEGORIES })
  @IsIn(NEWS_CATEGORIES)
  category: NewsCategoryLabel;

  @ApiProperty({
    description:
      'ISO 8601 datetime. Có thể đặt ở tương lai để lên lịch đăng bài (scheduled publish).',
  })
  @IsDateString()
  publishedAt: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  author: string;

  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  summary: string;

  @ApiProperty({ type: [String], maxItems: 30 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(5000, { each: true })
  content: string[];

  @ApiProperty({ type: [String], maxItems: 15 })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  tags: string[];

  @ApiProperty({
    type: [String],
    maxItems: 15,
    description:
      'Nhãn hiển thị dạng text, không phải link điều hướng thật; không validate theo URL/route.',
  })
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  relatedLinks: string[];

  @ApiPropertyOptional({
    maxLength: 2048,
    example: 'https://maps.app.goo.gl/example',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  @IsGoogleMapsUrl()
  googleMapsUrl?: string;

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
  imageAlt: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateNewsArticleDto extends NewsArticleContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateNewsArticleDto extends NewsArticleContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
