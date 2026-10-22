import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AgricultureCategoryLabel } from '../agriculture.constants';
import { GalleryImageResponseDto } from '../../media/dto/gallery-image-response.dto';

export class AgricultureListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Cây trồng chủ lực', 'Chăn nuôi', 'Thủy lợi', 'Mô hình sản xuất'],
  })
  category: AgricultureCategoryLabel;

  @ApiProperty()
  location: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;

  @ApiProperty()
  season: string;

  @ApiProperty()
  scale: string;

  @ApiProperty()
  summary: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  imageAlt: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  updatedAt: Date;
}

export class AgricultureResponseDto extends AgricultureListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  support: string;

  @ApiProperty({ type: [GalleryImageResponseDto] })
  galleryImages: GalleryImageResponseDto[];
}

export class AgricultureAdminResponseDto extends AgricultureResponseDto {
  @ApiPropertyOptional({ nullable: true })
  mediaId: string | null;

  @ApiProperty({ type: [String] })
  galleryMediaIds: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  version: number;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true })
  createdBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  updatedBy: string | null;
}
