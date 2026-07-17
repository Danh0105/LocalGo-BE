import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AgricultureCategoryLabel } from '../agriculture.constants';

export class AgricultureListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Cây trồng chủ lực', 'Chăn nuôi', 'Thủy lợi', 'Mô hình sản xuất'],
  })
  category: AgricultureCategoryLabel;

  @ApiProperty()
  location: string;

  @ApiProperty()
  season: string;

  @ApiProperty()
  scale: string;

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

export class AgricultureResponseDto extends AgricultureListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  support: string;
}

export class AgricultureAdminResponseDto extends AgricultureResponseDto {
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
