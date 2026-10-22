import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CraftVillageCategoryLabel } from '../craft-village.constants';
import { GalleryImageResponseDto } from '../../media/dto/gallery-image-response.dto';

export class CraftVillageListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: [
      'Thủ công truyền thống',
      'Chế biến nông sản',
      'Dịch vụ trải nghiệm',
      'Sản phẩm gia đình',
    ],
  })
  category: CraftVillageCategoryLabel;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;

  @ApiProperty()
  workingTime: string;

  @ApiProperty()
  mainProducts: string;

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

export class CraftVillageResponseDto extends CraftVillageListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  visitorNote: string;

  @ApiProperty({ type: [GalleryImageResponseDto] })
  galleryImages: GalleryImageResponseDto[];
}

export class CraftVillageAdminResponseDto extends CraftVillageResponseDto {
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
