import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TradePostPriceType } from '../../../../../generated/prisma';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../../categories/trade-post-category.constants';
import { MAX_TRADE_POST_IMAGES } from '../../trade.constants';

export class CreateTradePostDto {
  @ApiProperty({
    example: 'PRODUCT',
    description:
      'Mã danh mục ổn định từ GET /trade-post-categories; `id` danh mục là internal.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTradePostCategoryCode(value) : value,
  )
  @IsString()
  @Matches(TRADE_POST_CATEGORY_CODE_PATTERN)
  category: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  summary: string;

  @ApiProperty()
  @IsString()
  @Length(1, 5000)
  description: string;

  @ApiProperty({ enum: TradePostPriceType })
  @IsEnum(TradePostPriceType)
  priceType: TradePostPriceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'Liên hệ báo giá' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  priceLabel?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 300)
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  contactName: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^(\+?84|0)[0-9]{9}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  contactPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  contactZalo?: string;

  @ApiPropertyOptional({
    description: `Danh sách id ảnh đã tải lên qua POST /media/images (tối đa ${MAX_TRADE_POST_IMAGES})`,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRADE_POST_IMAGES)
  @IsUUID('4', { each: true })
  imageIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  promotionPercent?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promotionStartAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promotionEndAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
