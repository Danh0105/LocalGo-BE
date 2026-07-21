import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TradePostCategoriesAdminController } from './categories/controllers/trade-post-categories-admin.controller';
import { TradePostCategoriesController } from './categories/controllers/trade-post-categories.controller';
import { TradePostCategoryRepository } from './categories/repositories/trade-post-category.repository';
import { TradePostCategoryService } from './categories/services/trade-post-category.service';
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
    TradePostCategoriesController,
    TradePostCategoriesAdminController,
    TradePostsController,
    TradePostsAdminController,
    TradeReviewsController,
    ReviewsController,
    ReviewsAdminController,
  ],
  providers: [
    TradePostCategoryRepository,
    TradePostCategoryService,
    TradePostRepository,
    TradePostService,
    TradePostStatusService,
    TradeReviewRepository,
    TradeReviewService,
    TradeRatingService,
  ],
  exports: [
    TradePostCategoryService,
    TradePostService,
    TradePostStatusService,
    TradeReviewService,
  ],
})
export class TradeModule {}
