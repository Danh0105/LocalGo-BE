import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveBusinessApplicationDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) displayName: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  initialPassword: string;
}
