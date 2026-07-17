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

export class TempleEventInputDto {
  @ApiPropertyOptional({
    description:
      'Opaque UUID-shaped identifier returned by the temple detail API.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  id?: string | null;

  @ApiProperty({ example: '16/3 âm lịch', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  time: string;

  @ApiProperty({ example: 'Lễ Kỳ Yên', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;
}
