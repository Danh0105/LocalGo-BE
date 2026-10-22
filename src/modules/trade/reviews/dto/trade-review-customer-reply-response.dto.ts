import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TradeReviewCustomerReplyView } from '../entities/trade-review.entity';

export class TradeReviewCustomerReplyAuthorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
}

export class TradeReviewCustomerReplyResponseDto implements TradeReviewCustomerReplyView {
  @ApiProperty() id: string;
  @ApiProperty() reviewId: string;
  @ApiPropertyOptional({ nullable: true }) userId: string | null;
  @ApiProperty() content: string;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({
    type: () => TradeReviewCustomerReplyAuthorResponseDto,
    nullable: true,
    description: 'Null nếu tài khoản tác giả đã bị xóa.',
  })
  author: TradeReviewCustomerReplyAuthorResponseDto | null;

  static fromEntity(
    reply: TradeReviewCustomerReplyView,
  ): TradeReviewCustomerReplyResponseDto {
    return Object.assign(new TradeReviewCustomerReplyResponseDto(), reply);
  }
}
