import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SubmitFeedbackTicketDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  channelId?: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ maxLength: 30 })
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone: string;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  content: string;
}
