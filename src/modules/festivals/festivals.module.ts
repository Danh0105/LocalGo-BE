import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { FestivalsAdminController } from './controllers/festivals-admin.controller';
import { FestivalsController } from './controllers/festivals.controller';
import { FestivalService } from './services/festival.service';

@Module({
  imports: [MediaModule],
  controllers: [FestivalsController, FestivalsAdminController],
  providers: [FestivalService],
  exports: [FestivalService],
})
export class FestivalsModule {}
