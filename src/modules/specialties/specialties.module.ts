import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SpecialtiesAdminController } from './controllers/specialties-admin.controller';
import { SpecialtiesController } from './controllers/specialties.controller';
import { SpecialtyService } from './services/specialty.service';

@Module({
  imports: [MediaModule],
  controllers: [SpecialtiesController, SpecialtiesAdminController],
  providers: [SpecialtyService],
  exports: [SpecialtyService],
})
export class SpecialtiesModule {}
