import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ExperienceTourCategoryLabel } from '../experience-tour.constants';

export class ExperienceTourListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Nửa ngày', 'Một ngày', 'Gia đình', 'Học sinh', 'Nông nghiệp'],
  })
  category: ExperienceTourCategoryLabel;

  @ApiProperty()
  duration: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  priceRange: string;

  @ApiProperty()
  meetingPoint: string;

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

export class ExperienceTourResponseDto extends ExperienceTourListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({
    type: [String],
    description: 'Giữ nguyên thứ tự các bước như đã lưu.',
  })
  itinerary: string[];

  @ApiProperty({ type: [String] })
  included: string[];

  @ApiProperty()
  note: string;

  @ApiPropertyOptional({ nullable: true, example: '0900 123 456' })
  contactPhone: string | null;
}

export class ExperienceTourAdminResponseDto extends ExperienceTourResponseDto {
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
