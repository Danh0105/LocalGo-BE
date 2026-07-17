import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TemplesAdminController } from './controllers/temples-admin.controller';
import { TemplesController } from './controllers/temples.controller';
import { TempleService } from './services/temple.service';

@Module({
  imports: [MediaModule],
  controllers: [TemplesController, TemplesAdminController],
  providers: [TempleService],
  exports: [TempleService],
})
export class TemplesModule {}
