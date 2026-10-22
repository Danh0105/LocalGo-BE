import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BusinessApplicantType,
  BusinessType,
} from '../../../../generated/prisma';
import { BusinessApplicationDocumentInputDto } from './business-application-document-input.dto';

export class UpsertBusinessApplicationDto {
  @ApiProperty({ enum: BusinessApplicantType })
  @IsEnum(BusinessApplicantType)
  applicantType: BusinessApplicantType;

  @ApiPropertyOptional({
    enum: BusinessType,
    default: BusinessType.GENERAL,
    description:
      'Loại hình đăng ký. Trường/giấy tờ bắt buộc theo từng loại hình: GET /business-applications/business-types',
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiProperty({
    description:
      'Tên cơ sở / Ban quản lý (vd. "Nhà hàng Bến Sông", "Ban quản lý Đền Bà")',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional({
    description: 'Lĩnh vực cụ thể. Bỏ trống thì dùng tên loại hình.',
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
    description: 'RESTAURANT / ACCOMMODATION, vd. "6:00 – 22:00"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  openingHours?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'RESTAURANT' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  seatingCapacity?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'ACCOMMODATION' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  roomCount?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'GARDEN, vd. "2 ha"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gardenArea?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'GARDEN (bắt buộc), vd. "Sầu riêng, bưởi da xanh"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainProducts?: string | null;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) contactName: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/, {
    message: 'Số điện thoại Việt Nam không hợp lệ',
  })
  contactPhone: string;

  @ApiProperty() @IsEmail() @MaxLength(254) contactEmail: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(500) address: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identityNumber?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  identityIssuedAt?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  identityIssuedPlace?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  legalName?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxCode?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeName?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeTitle?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({
    description: 'Zalo ID của người nộp hồ sơ, dùng làm tham chiếu xác thực',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  zaloId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zaloDisplayName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  zaloAvatarUrl?: string | null;

  @ApiProperty({ type: [BusinessApplicationDocumentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BusinessApplicationDocumentInputDto)
  documents: BusinessApplicationDocumentInputDto[];
}
