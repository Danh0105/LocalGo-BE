import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CuisineCategoryLabel } from '../cuisine.constants';
import { MapLocationResponseDto } from '../../../common/dto/map-location-response.dto';

export class CuisineSuggestedPlaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;

  @ApiPropertyOptional({
    type: MapLocationResponseDto,
    nullable: true,
    readOnly: true,
  })
  mapLocation: MapLocationResponseDto | null;
}

export class CuisineGalleryImageResponseDto {
  @ApiProperty()
  mediaId: string;

  @ApiProperty()
  imageUrl: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  sortOrder: number;
}

export class CuisineMenuItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: string;

  @ApiProperty()
  description: string;
}

export class CuisineReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewerName: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty()
  feedback: string;

  @ApiProperty()
  adminResponse: string;
}

export class CuisineListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Món nước', 'Món nướng', 'Món cuốn', 'Ăn vặt', 'Món chay'],
  })
  category: CuisineCategoryLabel;

  @ApiProperty()
  priceRange: string;

  @ApiProperty()
  bestTime: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;

  @ApiPropertyOptional({
    type: MapLocationResponseDto,
    nullable: true,
    readOnly: true,
  })
  mapLocation: MapLocationResponseDto | null;

  @ApiProperty({
    type: [String],
    deprecated: true,
    description: 'Deprecated — dùng suggestedPlaceDetails[].name.',
  })
  suggestedPlaces: string[];

  @ApiProperty({ type: [CuisineSuggestedPlaceResponseDto] })
  suggestedPlaceDetails: CuisineSuggestedPlaceResponseDto[];

  @ApiProperty()
  summary: string;

  @ApiProperty({ minimum: 0, maximum: 5, example: 4.8 })
  averageRating: number;

  @ApiProperty({ minimum: 0 })
  reviewCount: number;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  imageAlt: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  updatedAt: Date;
}

export class CuisineResponseDto extends CuisineListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  tip: string;

  @ApiProperty()
  contactPhone: string;

  @ApiProperty({ type: [CuisineMenuItemResponseDto] })
  menu: CuisineMenuItemResponseDto[];

  @ApiProperty({ type: [CuisineReviewResponseDto] })
  reviews: CuisineReviewResponseDto[];

  @ApiProperty({ type: [CuisineGalleryImageResponseDto] })
  galleryImages: CuisineGalleryImageResponseDto[];
}

export class CuisineAdminResponseDto extends CuisineResponseDto {
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
