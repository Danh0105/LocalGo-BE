import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentReviewsAdminController } from './controllers/content-reviews-admin.controller';
import { ContentReviewsController } from './controllers/content-reviews.controller';
import { ContentReviewTargetService } from './services/content-review-target.service';
import { ContentReviewService } from './services/content-review.service';

/**
 * Star ratings + comments on the content sections. Section modules import
 * this only to call ContentReviewService.deleteForRecord() from their remove().
 */
@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [ContentReviewsController, ContentReviewsAdminController],
  providers: [ContentReviewService, ContentReviewTargetService],
  exports: [ContentReviewService],
})
export class ContentReviewsModule {}
