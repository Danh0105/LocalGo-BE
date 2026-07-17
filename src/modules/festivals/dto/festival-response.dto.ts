import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FestivalCategoryLabel } from '../festival.constants';

export class FestivalListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: [
      'Lễ truyền thống',
      'Văn hóa cộng đồng',
      'Thể thao - vui chơi',
      'Sự kiện nông sản',
    ],
  })
  category: FestivalCategoryLabel;

  @ApiProperty()
  time: string;

  @ApiProperty()
  location: string;

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

export class FestivalResponseDto extends FestivalListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  activities: string[];

  @ApiProperty()
  note: string;
}

export class FestivalAdminResponseDto extends FestivalResponseDto {
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
