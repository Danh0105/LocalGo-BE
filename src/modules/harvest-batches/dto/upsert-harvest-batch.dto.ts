import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? (value as unknown[]).map((item) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class CreateHarvestBatchDto {
  @ApiPropertyOptional({
    example: 'Nguyễn Văn An',
    maxLength: 120,
    description:
      'Tên chủ vườn in trên tem. Bỏ trống thì lấy tên hiển thị của tài khoản.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  ownerName?: string;

  @ApiProperty({ example: 'Sầu riêng Ri6', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  fruitName: string;

  @ApiProperty({
    example: '2026-10-21',
    description: 'Ngày cắt (YYYY-MM-DD), không được sau hôm nay (giờ VN).',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'harvestDate phải có dạng YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  harvestDate: string;

  @ApiProperty({
    example: 12.5,
    description: 'Trọng lượng (kg), tối đa 2 chữ số thập phân.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  weightKg: number;

  @ApiProperty({ example: 85000, description: 'Giá bán (VNĐ/kg).' })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  pricePerKg: number;

  @ApiProperty({
    example: 'Phân hữu cơ vi sinh, NPK 16-16-8',
    maxLength: 2000,
    description: 'Phân bón đã sử dụng (chủ vườn tự khai báo).',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  fertilizers: string;

  @ApiProperty({
    example: 'Không sử dụng',
    maxLength: 2000,
    description: 'Thuốc bảo vệ thực vật đã sử dụng (chủ vườn tự khai báo).',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  pesticides: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 10,
    description:
      'ID ảnh đã upload qua /media/images/batch, theo đúng thứ tự hiển thị.',
  })
  @IsOptional()
  @Transform(trimArray)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageIds?: string[];
}

export class UpdateHarvestBatchDto extends PartialType(CreateHarvestBatchDto) {}
