import { ApiProperty } from '@nestjs/swagger';

export class SaveTradePostResponseDto {
  @ApiProperty({ description: 'Người dùng hiện đã lưu tin này hay chưa.' })
  saved: boolean;

  @ApiProperty({ description: 'Tổng số người đang lưu tin này.' })
  saveCount: number;
}
