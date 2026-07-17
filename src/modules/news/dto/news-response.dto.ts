import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { NewsCategoryLabel } from '../news.constants';

export class NewsArticleListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    enum: [
      'Thông báo',
      'Hoạt động xã',
      'Du lịch',
      'Nông nghiệp',
      'Chuyển đổi số',
    ],
  })
  category: NewsCategoryLabel;

  @ApiProperty()
  publishedAt: Date;

  @ApiProperty()
  author: string;

  @ApiProperty()
  summary: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  imageAlt: string;

  @ApiProperty()
  updatedAt: Date;
}

export class NewsArticleResponseDto extends NewsArticleListItemResponseDto {
  @ApiProperty({ type: [String] })
  content: string[];

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({
    type: [String],
    description: 'Nhãn hiển thị dạng text, không phải link điều hướng thật.',
  })
  relatedLinks: string[];
}

export class NewsArticleAdminResponseDto extends NewsArticleResponseDto {
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
