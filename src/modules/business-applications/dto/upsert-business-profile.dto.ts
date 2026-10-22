import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsGoogleMapsUrl } from '../../../common/validation/google-maps-url.validator';

export class CreateBusinessProfileDto {
  @ApiProperty({ example: 'Nhà hàng Bến Sông' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional({
    description: 'Lĩnh vực chi tiết; mặc định là nhãn loại hình tài khoản.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessCategory?: string;

  @ApiPropertyOptional({ nullable: true, description: 'TEMPLE_MANAGEMENT' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  templeName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'RESTAURANT / ACCOMMODATION',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  openingHours?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'RESTAURANT' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  seatingCapacity?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'ACCOMMODATION' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  roomCount?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'GARDEN' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gardenArea?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'GARDEN' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainProducts?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/, {
    message: 'Số điện thoại Việt Nam không hợp lệ',
  })
  contactPhone: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  contactEmail: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsGoogleMapsUrl()
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  facebookUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  zaloOaUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateBusinessProfileDto extends PartialType(
  CreateBusinessProfileDto,
) {
  @ApiProperty({ minimum: 1, description: 'Version hiện tại để chống ghi đè.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class AdminCreateBusinessProfileDto extends CreateBusinessProfileDto {
  @ApiProperty({ description: 'ID tài khoản BUSINESS sở hữu hồ sơ.' })
  @IsString()
  @MinLength(1)
  userId: string;
}
