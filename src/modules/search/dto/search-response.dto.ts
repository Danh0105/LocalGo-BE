import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SEARCH_RESOURCE_TYPES,
  type SearchResourceType,
} from '../search.constants';

export class SearchResultDto {
  @ApiProperty({ enum: SEARCH_RESOURCE_TYPES })
  resourceType: SearchResourceType;

  @ApiProperty({ example: 'Đặc sản' })
  resourceLabel: string;

  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  slug: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiPropertyOptional({ nullable: true })
  category: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    description:
      'ACTIVE/HIDDEN cho CMS; trạng thái nghiệp vụ tương ứng cho NEWS, ABOUT và TRADE_POST',
  })
  status: string;

  @ApiProperty()
  updatedAt: Date;
}
