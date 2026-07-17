import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CuisineCategoryLabel } from '../cuisine.constants';

export class CuisineSuggestedPlaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 'https://maps.app.goo.gl/example' })
  googleMapsUrl: string;
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

  @ApiProperty({
    type: [String],
    deprecated: true,
    description: 'Deprecated — dùng suggestedPlaceDetails[].name.',
  })
  suggestedPlaces: string[];

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

export class CuisineResponseDto extends CuisineListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  tip: string;

  @ApiProperty({ type: [CuisineSuggestedPlaceResponseDto] })
  suggestedPlaceDetails: CuisineSuggestedPlaceResponseDto[];
}

export class CuisineAdminResponseDto extends CuisineResponseDto {
  @ApiPropertyOptional({ nullable: true })
  mediaId: string | null;

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
