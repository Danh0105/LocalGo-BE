import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CraftVillagesAdminController } from './controllers/craft-villages-admin.controller';
import { CraftVillagesController } from './controllers/craft-villages.controller';
import { CraftVillageService } from './services/craft-village.service';

@Module({
  imports: [MediaModule],
  controllers: [CraftVillagesController, CraftVillagesAdminController],
  providers: [CraftVillageService],
  exports: [CraftVillageService],
})
export class CraftVillagesModule {}
