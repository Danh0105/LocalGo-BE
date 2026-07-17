import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ZaloLoginDto {
  @ApiProperty({
    description:
      'Access token lấy từ zmp-sdk getAccessToken(). Ở môi trường dev (ZALO_AUTH_MODE=mock), dùng định dạng mock:<zaloId>:<displayName>.',
  })
  @IsString()
  @MinLength(1)
  accessToken: string;
}
