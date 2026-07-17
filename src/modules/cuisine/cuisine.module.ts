import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CuisineAdminController } from './controllers/cuisine-admin.controller';
import { CuisineController } from './controllers/cuisine.controller';
import { CuisineService } from './services/cuisine.service';

@Module({
  imports: [MediaModule],
  controllers: [CuisineController, CuisineAdminController],
  providers: [CuisineService],
  exports: [CuisineService],
})
export class CuisineModule {}
