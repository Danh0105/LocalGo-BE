import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'garden@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email: string;
}
