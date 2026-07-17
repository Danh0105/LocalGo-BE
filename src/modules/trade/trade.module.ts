import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TradePostsAdminController } from './posts/controllers/trade-posts-admin.controller';
import { TradePostsController } from './posts/controllers/trade-posts.controller';
import { TradePostRepository } from './posts/repositories/trade-post.repository';
import { TradePostStatusService } from './posts/services/trade-post-status.service';
import { TradePostService } from './posts/services/trade-post.service';
import { ReviewsAdminController } from './reviews/controllers/reviews-admin.controller';
import { ReviewsController } from './reviews/controllers/reviews.controller';
import { TradeReviewsController } from './reviews/controllers/trade-reviews.controller';
import { TradeReviewRepository } from './reviews/repositories/trade-review.repository';
import { TradeRatingService } from './reviews/services/trade-rating.service';
import { TradeReviewService } from './reviews/services/trade-review.service';

@Module({
  imports: [MediaModule],
  controllers: [
    TradePostsController,
    TradePostsAdminController,
    TradeReviewsController,
    ReviewsController,
    ReviewsAdminController,
  ],
  providers: [
    TradePostRepository,
    TradePostService,
    TradePostStatusService,
    TradeReviewRepository,
    TradeReviewService,
    TradeRatingService,
  ],
  exports: [TradePostService, TradePostStatusService, TradeReviewService],
})
export class TradeModule {}
