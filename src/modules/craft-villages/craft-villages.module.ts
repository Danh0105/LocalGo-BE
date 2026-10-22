import { Module } from '@nestjs/common';
import { ContentReviewsModule } from '../content-reviews/content-reviews.module';
import { MediaModule } from '../media/media.module';
import { CraftVillagesAdminController } from './controllers/craft-villages-admin.controller';
import { CraftVillagesController } from './controllers/craft-villages.controller';
import { CraftVillageService } from './services/craft-village.service';

@Module({
  imports: [MediaModule, ContentReviewsModule],
  controllers: [CraftVillagesController, CraftVillagesAdminController],
  providers: [CraftVillageService],
  exports: [CraftVillageService],
})
export class CraftVillagesModule {}
