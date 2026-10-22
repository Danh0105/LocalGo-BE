import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TradePostStatus,
  UserStatus,
} from '../../../../../generated/prisma';
import type {
  TradeReviewAuthorView,
  TradeReviewEntity,
  TradeReviewPostView,
} from '../entities/trade-review.entity';
import { TradeReviewResponseDto } from './trade-review-response.dto';

export class TradeReviewPostResponseDto implements TradeReviewPostView {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING',
      'PUBLISHED',
      'HIDDEN',
      'REJECTED',
      'EXPIRED',
      'ARCHIVED',
    ],
  })
  status: TradePostStatus;
  @ApiProperty({ description: 'Tin đã bị xóa (soft delete)' })
  deleted: boolean;
}

export class TradeReviewAuthorResponseDto implements TradeReviewAuthorView {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED', 'PENDING'] })
  status: UserStatus;
}

/** Admin view of a review: the public fields plus who wrote it and on which post. */
export class TradeReviewAdminResponseDto extends TradeReviewResponseDto {
  // Widens the public post ref (id/title/slug) with status, thumbnail and deleted flag.
  @ApiProperty({ type: () => TradeReviewPostResponseDto, nullable: true })
  override tradePost: TradeReviewPostView | null = null;

  @ApiProperty({ type: () => TradeReviewAuthorResponseDto, nullable: true })
  user: TradeReviewAuthorView | null;

  static override fromEntity(
    entity: TradeReviewEntity,
  ): TradeReviewAdminResponseDto {
    const dto = Object.assign(
      new TradeReviewAdminResponseDto(),
      TradeReviewResponseDto.fromEntity(entity),
    );
    dto.tradePost = entity.tradePost ?? null;
    dto.user = entity.user ?? null;
    return dto;
  }
}

export class TradeReviewAdminStatsResponseDto {
  @ApiProperty() total: number;

  @ApiProperty({
    example: { PENDING: 3, PUBLISHED: 12, HIDDEN: 1 },
    description: 'Số đánh giá (chưa xóa) theo từng trạng thái',
  })
  byStatus: Record<'PENDING' | 'PUBLISHED' | 'HIDDEN', number>;
}
