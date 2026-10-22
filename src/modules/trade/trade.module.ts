import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ZaloModule } from '../zalo/zalo.module';

// Categories
import { TradePostCategoriesAdminController } from './categories/controllers/trade-post-categories-admin.controller';
import { TradePostCategoriesController } from './categories/controllers/trade-post-categories.controller';
import { TradePostCategoryRepository } from './categories/repositories/trade-post-category.repository';
import { TradePostCategoryService } from './categories/services/trade-post-category.service';

// Common
import { SellerAccessGuard } from './common/seller-access.guard';

// Conversations
import { TradeConversationsController } from './conversations/controllers/trade-conversations.controller';
import { TradeConversationsAdminController } from './conversations/controllers/trade-conversations-admin.controller';
import { TradeConversationRepository } from './conversations/repositories/trade-conversation.repository';
import { TradeConversationService } from './conversations/services/trade-conversation.service';
import { TradeConversationAdminService } from './conversations/services/trade-conversation-admin.service';

// Favorites
import { TradePostFavoritesController } from './favorites/controllers/trade-post-favorites.controller';
import { TradePostFavoriteRepository } from './favorites/repositories/trade-post-favorite.repository';
import { TradePostFavoriteService } from './favorites/services/trade-post-favorite.service';

// Posts
import { TradePostAnalyticsAdminController } from './posts/controllers/trade-posts-analytics-admin.controller';
import { TradePostAnalyticsController } from './posts/controllers/trade-posts-analytics.controller';
import { TradePostsAdminController } from './posts/controllers/trade-posts-admin.controller';
import { TradePostsController } from './posts/controllers/trade-posts.controller';
import { TradePostEventRepository } from './posts/repositories/trade-post-event.repository';
import { TradePostRepository } from './posts/repositories/trade-post.repository';
import { TradePostAnalyticsService } from './posts/services/trade-post-analytics.service';
import { TradePostEngagementService } from './posts/services/trade-post-engagement.service';
import { TradePostStatusService } from './posts/services/trade-post-status.service';
import { TradePostService } from './posts/services/trade-post.service';

// Reviews
import { ReviewsAdminController } from './reviews/controllers/reviews-admin.controller';
import { ReviewsController } from './reviews/controllers/reviews.controller';
import { TradeManagementReviewsController } from './reviews/controllers/trade-management-reviews.controller';
import { TradeReviewsController } from './reviews/controllers/trade-reviews.controller';
import { TradeReviewRepository } from './reviews/repositories/trade-review.repository';
import { TradeRatingService } from './reviews/services/trade-rating.service';
import { TradeReviewService } from './reviews/services/trade-review.service';

@Module({
  imports: [MediaModule, UsersModule, ZaloModule, NotificationsModule],

  controllers: [
    // Categories
    TradePostCategoriesController,
    TradePostCategoriesAdminController,

    // Posts
    TradePostsController,
    TradePostsAdminController,
    TradePostAnalyticsController,
    TradePostAnalyticsAdminController,

    // Favorites
    TradePostFavoritesController,

    // Reviews
    TradeReviewsController,
    ReviewsController,
    ReviewsAdminController,
    TradeManagementReviewsController,

    // Conversations
    TradeConversationsController,
    TradeConversationsAdminController,
  ],

  providers: [
    SellerAccessGuard,

    // Conversations
    TradeConversationRepository,
    TradeConversationService,
    TradeConversationAdminService,

    // Categories
    TradePostCategoryRepository,
    TradePostCategoryService,

    // Posts
    TradePostRepository,
    TradePostEventRepository,
    TradePostService,
    TradePostStatusService,
    TradePostEngagementService,
    TradePostAnalyticsService,

    // Favorites
    TradePostFavoriteRepository,
    TradePostFavoriteService,

    // Reviews
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
