import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FeedbackChannelCategoryLabel } from '../feedback-channel.constants';

export class FeedbackChannelListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    enum: [
      'Góp ý chung',
      'Phản ánh hạ tầng',
      'Dịch vụ công',
      'Du lịch',
      'Mini App',
    ],
  })
  category: FeedbackChannelCategoryLabel;

  @ApiProperty()
  responseTime: string;

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

export class FeedbackChannelResponseDto extends FeedbackChannelListItemResponseDto {
  @ApiProperty({ type: [String] })
  requiredInfo: string[];

  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  examples: string[];

  @ApiProperty()
  note: string;
}

export class FeedbackChannelAdminResponseDto extends FeedbackChannelResponseDto {
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
