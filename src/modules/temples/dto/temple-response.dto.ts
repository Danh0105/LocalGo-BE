import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TempleTypeLabel } from '../temple.constants';

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

  @ApiProperty({ enum: ['Đình', 'Chùa', 'Miếu'] })
  type: TempleTypeLabel;

  @ApiProperty()
  address: string;

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
