import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ExperienceToursAdminController } from './controllers/experience-tours-admin.controller';
import { ExperienceToursController } from './controllers/experience-tours.controller';
import { ExperienceTourService } from './services/experience-tour.service';

@Module({
  imports: [MediaModule],
  controllers: [ExperienceToursController, ExperienceToursAdminController],
  providers: [ExperienceTourService],
  exports: [ExperienceTourService],
})
export class ExperienceToursModule {}
