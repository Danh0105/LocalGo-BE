import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MediaEntity } from '../entities/media.entity';

export class MediaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  width: number | null;

  @ApiPropertyOptional({ nullable: true })
  height: number | null;

  @ApiProperty()
  size: number;

  @ApiProperty()
  mimeType: string;

  static fromEntity(entity: MediaEntity): MediaResponseDto {
    const dto = new MediaResponseDto();
    dto.id = entity.id;
    dto.url = entity.originalUrl;
    dto.thumbnailUrl = entity.thumbnailUrl;
    dto.width = entity.width;
    dto.height = entity.height;
    dto.size = entity.size;
    dto.mimeType = entity.mimeType;
    return dto;
  }
}
