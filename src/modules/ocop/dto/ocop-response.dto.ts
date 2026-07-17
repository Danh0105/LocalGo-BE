import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { OcopCategoryLabel, OcopRatingValue } from '../ocop.constants';

export class OcopListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Thực phẩm', 'Đồ uống', 'Nông sản tươi', 'Sản phẩm chế biến'],
  })
  category: OcopCategoryLabel;

  @ApiProperty({ enum: [3, 4, 5] })
  rating: OcopRatingValue;

  @ApiProperty()
  producer: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  priceRange: string;

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

export class OcopResponseDto extends OcopListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  contactNote: string;

  @ApiPropertyOptional({ nullable: true, example: '0900 123 456' })
  contactPhone: string | null;
}

export class OcopAdminResponseDto extends OcopResponseDto {
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
