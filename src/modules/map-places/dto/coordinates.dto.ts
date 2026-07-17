import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class CoordinatesDto {
  @ApiProperty({ minimum: -90, maximum: 90, example: 11.2418 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: 106.2024 })
  @IsLongitude()
  lng: number;
}
