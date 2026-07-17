import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AboutSnapshot } from '../types/about-snapshot.type';

export class AboutHeroResponseDto {
  @ApiProperty() imageUrl: string;
  @ApiProperty() imageAlt: string;
}

export class AboutOverviewResponseDto {
  @ApiProperty() title: string;
  @ApiProperty({ type: [String] }) paragraphs: string[];
}

export class AboutStatisticResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() value: string;
  @ApiProperty() unit: string;
  @ApiProperty() label: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isActive: boolean;
}

export class AboutHighlightResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() imageUrl: string;
  @ApiProperty() imageAlt: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isActive: boolean;
}

export class AboutMilestoneResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() year: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isActive: boolean;
}

export class AboutResponseDto {
  @ApiProperty({ example: 'about' }) id: 'about';
  @ApiProperty() title: string;
  @ApiProperty({ type: AboutHeroResponseDto }) hero: AboutHeroResponseDto;
  @ApiProperty({ type: AboutOverviewResponseDto })
  overview: AboutOverviewResponseDto;
  @ApiProperty({ type: [AboutStatisticResponseDto] })
  statistics: AboutStatisticResponseDto[];
  @ApiProperty() highlightsSectionTitle: string;
  @ApiProperty({ type: [AboutHighlightResponseDto] })
  highlights: AboutHighlightResponseDto[];
  @ApiProperty() milestonesSectionTitle: string;
  @ApiProperty({ type: [AboutMilestoneResponseDto] })
  milestones: AboutMilestoneResponseDto[];
  @ApiPropertyOptional({ nullable: true }) publishedAt: Date | null;
  @ApiProperty() updatedAt: Date;
  @ApiProperty() version: number;
}

export class AboutAdminStateDto {
  @ApiProperty({ type: Object }) draft: AboutSnapshot;
  @ApiProperty() version: number;
  @ApiProperty() publishedVersion: number;
  @ApiPropertyOptional({ nullable: true }) publishedAt: Date | null;
  @ApiProperty() updatedAt: Date;
  @ApiProperty() hasUnpublishedChanges: boolean;
}
