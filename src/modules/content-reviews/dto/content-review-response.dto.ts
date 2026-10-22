import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentReviewStatus, UserStatus } from '../../../../generated/prisma';
import {
  CONTENT_REVIEW_TARGET_TYPES,
  type ContentReviewTargetTypeName,
} from '../content-review.constants';

type StarKey = '1' | '2' | '3' | '4' | '5';

export class ContentReviewImageResponseDto {
  @ApiProperty({ description: 'mediaId của ảnh' })
  id: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  sortOrder: number;
}

export class ContentReviewReviewerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;
}

export class ContentReviewTargetResponseDto {
  @ApiProperty({ enum: CONTENT_REVIEW_TARGET_TYPES })
  targetType: ContentReviewTargetTypeName;

  @ApiProperty()
  id: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null khi mục đã bị xóa',
  })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Mục đang hiển thị công khai' })
  isActive: boolean;

  @ApiProperty({ description: 'Mục đã bị xóa' })
  deleted: boolean;
}

/** Public review shape — reviewer without contact details, reply without the admin's identity. */
export class ContentReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: CONTENT_REVIEW_TARGET_TYPES })
  targetType: ContentReviewTargetTypeName;

  @ApiProperty({ description: 'Id (slug) của mục được đánh giá' })
  targetId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ContentReviewStatus })
  status: ContentReviewStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Phản hồi công khai của ban quản lý',
  })
  replyContent: string | null;

  @ApiPropertyOptional({ nullable: true })
  repliedAt: Date | null;

  @ApiProperty({ type: [ContentReviewImageResponseDto] })
  images: ContentReviewImageResponseDto[];

  @ApiProperty({ type: ContentReviewReviewerResponseDto })
  reviewer: ContentReviewReviewerResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/** "My reviews" item: the review plus the item it is about. */
export class ContentReviewWithTargetResponseDto extends ContentReviewResponseDto {
  @ApiProperty({ type: ContentReviewTargetResponseDto })
  target: ContentReviewTargetResponseDto;
}

export class ContentReviewAuthorResponseDto extends ContentReviewReviewerResponseDto {
  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;
}

export class ContentReviewReplierResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;
}

export class ContentReviewAdminResponseDto extends ContentReviewWithTargetResponseDto {
  @ApiProperty({ type: ContentReviewAuthorResponseDto })
  user: ContentReviewAuthorResponseDto;

  @ApiPropertyOptional({
    type: ContentReviewReplierResponseDto,
    nullable: true,
    description: 'Quản trị viên đã viết phản hồi',
  })
  repliedBy: ContentReviewReplierResponseDto | null;
}

export class ContentReviewSummaryResponseDto {
  @ApiProperty({ description: 'Điểm trung bình (0 nếu chưa có đánh giá)' })
  average: number;

  @ApiProperty({ description: 'Tổng số đánh giá đang hiển thị' })
  total: number;

  @ApiProperty({
    description: 'Phần trăm mỗi mức sao (1-5), làm tròn tới số nguyên',
    example: { '1': 0, '2': 0, '3': 5, '4': 13, '5': 82 },
  })
  distribution: Record<StarKey, number>;

  @ApiProperty({
    description: 'Số lượng tuyệt đối mỗi mức sao (1-5)',
    example: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 20 },
  })
  counts: Record<StarKey, number>;
}

export class ContentReviewRatingResponseDto {
  @ApiProperty()
  targetId: string;

  @ApiProperty({ description: 'Điểm trung bình (0 nếu chưa có đánh giá)' })
  average: number;

  @ApiProperty({ description: 'Số đánh giá đang hiển thị' })
  total: number;
}

export class ContentReviewAdminStatsResponseDto {
  @ApiProperty({ description: 'Tổng số đánh giá chưa xóa' })
  total: number;

  @ApiProperty({ example: { PUBLISHED: 12, HIDDEN: 1 } })
  byStatus: Record<ContentReviewStatus, number>;

  @ApiProperty({
    description: 'Số đánh giá chưa xóa theo từng mục',
    example: { temples: 5, cuisine: 8 },
  })
  byTargetType: Record<ContentReviewTargetTypeName, number>;

  @ApiProperty({ description: 'Số đánh giá đang hiển thị chưa được phản hồi' })
  unreplied: number;
}
