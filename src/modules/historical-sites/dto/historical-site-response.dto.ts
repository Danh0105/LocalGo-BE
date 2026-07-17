import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HistoricalSiteRankLabel } from '../historical-site.constants';

export class HistoricalSiteListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['Cấp quốc gia', 'Cấp tỉnh', 'Chưa xếp hạng'] })
  rank: HistoricalSiteRankLabel;

  @ApiProperty()
  address: string;

  @ApiPropertyOptional({ nullable: true })
  recognizedYear: number | null;

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

export class HistoricalSiteResponseDto extends HistoricalSiteListItemResponseDto {
  @ApiProperty({ type: [String] })
  history: string[];

  @ApiProperty({ type: [String] })
  highlights: string[];
}

export class HistoricalSiteAdminResponseDto extends HistoricalSiteResponseDto {
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
