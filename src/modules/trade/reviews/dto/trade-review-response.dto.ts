import { ApiProperty } from '@nestjs/swagger';
import type { TradeReviewStatus } from '../../../../../generated/prisma';
import type {
  TradeReviewEntity,
  TradeReviewImageView,
} from '../entities/trade-review.entity';

export class TradeReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tradePostId: string;
  @ApiProperty() userId: string;
  @ApiProperty() rating: number;
  @ApiProperty() content: string;
  @ApiProperty({ enum: ['PENDING', 'PUBLISHED', 'HIDDEN'] })
  status: TradeReviewStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: () => Object, isArray: true })
  images: TradeReviewImageView[];

  static fromEntity(entity: TradeReviewEntity): TradeReviewResponseDto {
    const dto = new TradeReviewResponseDto();
    dto.id = entity.id;
    dto.tradePostId = entity.tradePostId;
    dto.userId = entity.userId;
    dto.rating = entity.rating;
    dto.content = entity.content;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.images = entity.images;
    return dto;
  }
}
