import { Module } from '@nestjs/common';
import { ContentReviewsModule } from '../content-reviews/content-reviews.module';
import { MediaModule } from '../media/media.module';
import { AgricultureAdminController } from './controllers/agriculture-admin.controller';
import { AgricultureController } from './controllers/agriculture.controller';
import { AgricultureService } from './services/agriculture.service';

@Module({
  imports: [MediaModule, ContentReviewsModule],
  controllers: [AgricultureController, AgricultureAdminController],
  providers: [AgricultureService],
  exports: [AgricultureService],
})
export class AgricultureModule {}
