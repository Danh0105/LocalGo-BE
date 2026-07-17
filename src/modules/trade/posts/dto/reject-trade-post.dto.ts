import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectTradePostDto {
  @ApiProperty({ description: 'Lý do từ chối tin đăng' })
  @IsString()
  @Length(1, 500)
  reason: string;
}
