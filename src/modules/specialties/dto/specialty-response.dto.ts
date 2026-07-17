import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SpecialtyCategoryLabel } from '../specialty.constants';

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

  @ApiProperty({ type: [String] })
  buyPlaces: string[];
}

export class SpecialtyAdminResponseDto extends SpecialtyResponseDto {
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
