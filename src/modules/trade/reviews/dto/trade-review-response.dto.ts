import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TradeReviewStatus } from '../../../../../generated/prisma';
import type {
  TradeReviewCustomerReplyView,
  TradeReviewEntity,
  TradeReviewImageView,
  TradeReviewReviewerView,
} from '../entities/trade-review.entity';
import { TradeReviewCustomerReplyResponseDto } from './trade-review-customer-reply-response.dto';

export class TradeReviewReviewerResponseDto implements TradeReviewReviewerView {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
}

export class TradeReviewPostRefResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
}

/** Public review shape — no owner id or contact details. */
export class TradeReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tradePostId: string;
  @ApiProperty() userId: string;
  @ApiProperty() rating: number;
  @ApiProperty() content: string;
  @ApiProperty({ enum: ['PENDING', 'PUBLISHED', 'HIDDEN'] })
  status: TradeReviewStatus;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Phản hồi công khai của người đăng tin',
  })
  replyContent: string | null;
  @ApiPropertyOptional({ nullable: true }) repliedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: () => Object, isArray: true })
  images: TradeReviewImageView[];
  @ApiProperty({
    type: () => TradeReviewCustomerReplyResponseDto,
    isArray: true,
  })
  customerReplies: TradeReviewCustomerReplyView[];
  @ApiPropertyOptional({
    type: () => TradeReviewReviewerResponseDto,
    nullable: true,
  })
  reviewer: TradeReviewReviewerView | null;
  @ApiPropertyOptional({
    type: () => TradeReviewPostRefResponseDto,
    nullable: true,
  })
  tradePost: TradeReviewPostRefResponseDto | null;

  static fromEntity(entity: TradeReviewEntity): TradeReviewResponseDto {
    const dto = new TradeReviewResponseDto();
    dto.id = entity.id;
    dto.tradePostId = entity.tradePostId;
    dto.userId = entity.userId;
    dto.rating = entity.rating;
    dto.content = entity.content;
    dto.status = entity.status;
    dto.replyContent = entity.replyContent;
    dto.repliedAt = entity.repliedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.images = entity.images;
    dto.customerReplies = entity.customerReplies;
    dto.reviewer = entity.reviewer ?? null;
    dto.tradePost = entity.tradePost
      ? {
          id: entity.tradePost.id,
          title: entity.tradePost.title,
          slug: entity.tradePost.slug,
        }
      : null;
    return dto;
  }
}
