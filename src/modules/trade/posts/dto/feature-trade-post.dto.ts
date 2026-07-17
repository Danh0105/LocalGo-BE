import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class FeatureTradePostDto {
  @ApiProperty()
  @IsBoolean()
  featured: boolean;
}
