import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TempleTypeLabel } from '../temple.constants';
import { MapLocationResponseDto } from '../../../common/dto/map-location-response.dto';

export class TempleEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  time: string;

  @ApiProperty()
  name: string;
}

export class TempleListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['Đình', 'Đền', 'Chùa', 'Miếu'] })
  type: TempleTypeLabel;

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

  @ApiProperty()
  openHours: string;

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

export class TempleResponseDto extends TempleListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [TempleEventResponseDto] })
  events: TempleEventResponseDto[];
}

export class TempleAdminResponseDto extends TempleResponseDto {
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
