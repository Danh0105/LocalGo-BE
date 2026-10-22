import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GalleryImageResponseDto {
  @ApiProperty()
  mediaId: string;

  @ApiProperty()
  imageUrl: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  sortOrder: number;
}
