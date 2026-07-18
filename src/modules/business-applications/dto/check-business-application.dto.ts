import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CheckBusinessApplicationDto {
  @ApiProperty({
    description: 'Zalo ID dùng để tra cứu hồ sơ Business đã nộp trước đó',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  zaloId: string;
}
