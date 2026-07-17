import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CraftVillageCategoryLabel } from '../craft-village.constants';

export class CraftVillageListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: [
      'Thủ công truyền thống',
      'Chế biến nông sản',
      'Dịch vụ trải nghiệm',
      'Sản phẩm gia đình',
    ],
  })
  category: CraftVillageCategoryLabel;

  @ApiProperty()
  address: string;

  @ApiProperty()
  workingTime: string;

  @ApiProperty()
  mainProducts: string;

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

export class CraftVillageResponseDto extends CraftVillageListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];

  @ApiProperty()
  visitorNote: string;
}

export class CraftVillageAdminResponseDto extends CraftVillageResponseDto {
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
