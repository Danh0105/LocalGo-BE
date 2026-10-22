import { Module } from '@nestjs/common';
import { ContentReviewsModule } from '../content-reviews/content-reviews.module';
import { MediaModule } from '../media/media.module';
import { HistoricalSitesAdminController } from './controllers/historical-sites-admin.controller';
import { HistoricalSitesController } from './controllers/historical-sites.controller';
import { HistoricalSiteService } from './services/historical-site.service';

@Module({
  imports: [MediaModule, ContentReviewsModule],
  controllers: [HistoricalSitesController, HistoricalSitesAdminController],
  providers: [HistoricalSiteService],
  exports: [HistoricalSiteService],
})
export class HistoricalSitesModule {}
