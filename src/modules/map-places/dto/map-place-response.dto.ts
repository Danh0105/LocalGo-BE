import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MapPlaceCategoryLabel } from '../map-place.constants';
import { CoordinatesDto } from './coordinates.dto';
import { MapLocationResponseDto } from '../../../common/dto/map-location-response.dto';

export class MapPlaceListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Hành chính', 'Du lịch', 'Di tích', 'Ẩm thực', 'Dịch vụ'],
  })
  category: MapPlaceCategoryLabel;

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

  @ApiProperty({ type: CoordinatesDto })
  coordinates: CoordinatesDto;

  @ApiProperty()
  openTime: string;

  @ApiProperty()
  distanceFromCenter: string;

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

export class MapPlaceResponseDto extends MapPlaceListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  directionNote: string;
}

export class MapPlaceAdminResponseDto extends MapPlaceResponseDto {
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
