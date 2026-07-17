import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
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
} from 'class-validator';
import {
  CONTACT_CATEGORIES,
  type ContactCategoryLabel,
} from '../contact.constants';

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
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class ContactContentDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: CONTACT_CATEGORIES })
  @IsIn(CONTACT_CATEGORIES)
  category: ContactCategoryLabel;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  role: string;

  @ApiProperty({
    maxLength: 30,
    description: 'Chỉ chữ số, khoảng trắng và tối đa một dấu + ở đầu',
  })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  workingTime: string;

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
  supportTopics: string[];

  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note: string;

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

export class CreateContactDto extends ContactContentDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
}

export class UpdateContactDto extends ContactContentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
