import { Module } from '@nestjs/common';
import { ContentReviewsModule } from '../content-reviews/content-reviews.module';
import { MediaModule } from '../media/media.module';
import { TemplesAdminController } from './controllers/temples-admin.controller';
import { TemplesController } from './controllers/temples.controller';
import { TempleService } from './services/temple.service';

@Module({
  imports: [MediaModule, ContentReviewsModule],
  controllers: [TemplesController, TemplesAdminController],
  providers: [TempleService],
  exports: [TempleService],
})
export class TemplesModule {}
