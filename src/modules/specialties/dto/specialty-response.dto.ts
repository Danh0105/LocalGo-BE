import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SpecialtyCategoryLabel } from '../specialty.constants';
import { GalleryImageResponseDto } from '../../media/dto/gallery-image-response.dto';

export class SpecialtyBuyPlaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;
}

export class SpecialtyListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['Món ăn', 'Trái cây', 'Quà mang về'] })
  category: SpecialtyCategoryLabel;

  @ApiProperty()
  price: string;

  @ApiProperty()
  season: string;

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

export class SpecialtyResponseDto extends SpecialtyListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({
    type: [String],
    deprecated: true,
    description: 'Deprecated — dùng buyPlaceDetails[].name.',
  })
  buyPlaces: string[];

  @ApiProperty({ type: [SpecialtyBuyPlaceResponseDto] })
  buyPlaceDetails: SpecialtyBuyPlaceResponseDto[];

  @ApiProperty({ type: [GalleryImageResponseDto] })
  galleryImages: GalleryImageResponseDto[];
}

export class SpecialtyAdminResponseDto extends SpecialtyResponseDto {
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

  @ApiPropertyOptional({ nullable: true, type: Date })
  deletedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  createdBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  updatedBy: string | null;
}
