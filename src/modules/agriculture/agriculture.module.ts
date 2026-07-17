import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { AgricultureAdminController } from './controllers/agriculture-admin.controller';
import { AgricultureController } from './controllers/agriculture.controller';
import { AgricultureService } from './services/agriculture.service';

@Module({
  imports: [MediaModule],
  controllers: [AgricultureController, AgricultureAdminController],
  providers: [AgricultureService],
  exports: [AgricultureService],
})
export class AgricultureModule {}
