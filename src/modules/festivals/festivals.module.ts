import { Module } from '@nestjs/common';
import { ContentReviewsModule } from '../content-reviews/content-reviews.module';
import { MediaModule } from '../media/media.module';
import { FestivalsAdminController } from './controllers/festivals-admin.controller';
import { FestivalsController } from './controllers/festivals.controller';
import { FestivalService } from './services/festival.service';

@Module({
  imports: [MediaModule, ContentReviewsModule],
  controllers: [FestivalsController, FestivalsAdminController],
  providers: [FestivalService],
  exports: [FestivalService],
})
export class FestivalsModule {}
