import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachReviewImageDto {
  @ApiProperty({ description: 'id ảnh đã tải lên qua POST /media/images' })
  @IsUUID('4')
  mediaId: string;
}
