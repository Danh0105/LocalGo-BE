import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type MapLocationStatusValue =
  'pending' | 'resolved' | 'unresolved' | 'failed';

export class MapLocationCoordinatesDto {
  @ApiProperty({ minimum: -90, maximum: 90, example: 11.2418 })
  lat: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: 106.2024 })
  lng: number;
}

export class MapLocationResponseDto {
  @ApiProperty({
    enum: ['pending', 'resolved', 'unresolved', 'failed'],
    example: 'resolved',
  })
  status: MapLocationStatusValue;

  @ApiPropertyOptional({
    type: MapLocationCoordinatesDto,
    nullable: true,
  })
  coordinates: MapLocationCoordinatesDto | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  resolvedAt: string | null;
}
