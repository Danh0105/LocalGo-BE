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
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsGoogleMapsUrl } from '../../../../common/validation/google-maps-url.validator';
import {
  TradePostPriceType,
  TradePostPurpose,
} from '../../../../../generated/prisma';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../../categories/trade-post-category.constants';
import { MAX_TRADE_POST_IMAGES } from '../../trade.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTradePostDto {
  @ApiProperty({
    example: 'PRODUCT',
    description:
      'BẮT BUỘC. Mã danh mục ổn định từ GET /trade-post-categories; `id` danh mục là internal.',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeTradePostCategoryCode(value) : value,
  )
  @IsString()
  @Matches(TRADE_POST_CATEGORY_CODE_PATTERN)
  category: string;

  @ApiProperty({
    required: true,
    minLength: 1,
    maxLength: 200,
    description: 'BẮT BUỘC. Tiêu đề tin giao thương.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    required: true,
    minLength: 1,
    maxLength: 500,
    description: 'BẮT BUỘC. Nội dung tóm tắt của tin.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  summary: string;

  @ApiProperty({
    required: true,
    minLength: 1,
    maxLength: 5000,
    description: 'BẮT BUỘC. Nội dung mô tả chi tiết.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  description: string;

  @ApiPropertyOptional({
    enum: TradePostPurpose,
    description:
      'COMMERCIAL (có lợi nhuận) hoặc NON_PROFIT (phi lợi nhuận, không có giá). Mặc định: COMMERCIAL, riêng tài khoản Ban quản lý đền/miếu mặc định và chỉ được NON_PROFIT.',
  })
  @IsOptional()
  @IsEnum(TradePostPurpose)
  purpose?: TradePostPurpose;

  @ApiPropertyOptional({
    enum: TradePostPriceType,
    description:
      'BẮT BUỘC KHI purpose = COMMERCIAL. Tin NON_PROFIT không có giá — priceType/price/priceLabel bị bỏ qua.',
  })
  @IsOptional()
  @IsEnum(TradePostPriceType)
  priceType?: TradePostPriceType;

  @ApiPropertyOptional({ nullable: true, description: 'null để xóa (PATCH)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({
    example: 'Liên hệ báo giá',
    nullable: true,
    description: 'null để xóa (PATCH)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  priceLabel?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Chỉ tin NON_PROFIT: thời điểm sự kiện (vd. ngày hội đền) bắt đầu.',
  })
  @IsOptional()
  @IsDateString()
  eventStartAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Chỉ tin NON_PROFIT: thời điểm sự kiện kết thúc (phải ở tương lai). Nếu không đặt expiresAt, tin tự ẩn khỏi danh sách công khai sau thời điểm này.',
  })
  @IsOptional()
  @IsDateString()
  eventEndAt?: string | null;

  @ApiProperty({
    required: true,
    minLength: 1,
    maxLength: 300,
    description: 'BẮT BUỘC. Địa chỉ của tin giao thương.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  address: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2048,
    example: 'https://maps.app.goo.gl/example',
    description:
      'TÙY CHỌN. Link Google Maps của địa điểm; PATCH nhận null để xóa.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  @IsGoogleMapsUrl()
  googleMapsUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiProperty({
    required: true,
    minLength: 1,
    maxLength: 120,
    description: 'BẮT BUỘC. Tên người liên hệ.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  contactName: string;

  @ApiProperty({
    required: true,
    example: '0901234567',
    description: 'BẮT BUỘC. Số điện thoại liên hệ Việt Nam.',
  })
  @Transform(trim)
  @IsString()
  @Matches(/^(\+?84|0)[0-9]{9}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  contactPhone: string;

  @ApiPropertyOptional({ nullable: true, description: 'null để xóa (PATCH)' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  contactZalo?: string | null;

  @ApiPropertyOptional({
    description: `Danh sách id ảnh đã tải lên qua POST /media/images hoặc POST /media/images/batch (tối đa ${MAX_TRADE_POST_IMAGES})`,
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

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Thời điểm tin hết hạn (ISO 8601), phải sau thời điểm hiện tại. Bỏ trống/null = không hết hạn.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
