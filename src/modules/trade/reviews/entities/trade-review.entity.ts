import type {
  Media,
  TradeReview,
  TradeReviewImage,
  TradeReviewStatus,
} from '../../../../../generated/prisma';

export interface TradeReviewImageView {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

export type TradeReviewWithImages = TradeReview & {
  images: (TradeReviewImage & { media: Media })[];
};

export class TradeReviewEntity {
  id: string;
  tradePostId: string;
  userId: string;
  rating: number;
  content: string;
  status: TradeReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  images: TradeReviewImageView[];

  constructor(review: TradeReview | TradeReviewWithImages) {
    this.id = review.id;
    this.tradePostId = review.tradePostId;
    this.userId = review.userId;
    this.rating = review.rating;
    this.content = review.content;
    this.status = review.status;
    this.createdAt = review.createdAt;
    this.updatedAt = review.updatedAt;
    this.images =
      'images' in review
        ? review.images
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((image) => ({
              id: image.mediaId,
              url: image.media.originalUrl,
              thumbnailUrl: image.media.thumbnailUrl,
              sortOrder: image.sortOrder,
            }))
        : [];
  }
}
