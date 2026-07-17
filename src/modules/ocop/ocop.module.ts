import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { OcopAdminController } from './controllers/ocop-admin.controller';
import { OcopController } from './controllers/ocop.controller';
import { OcopService } from './services/ocop.service';

@Module({
  imports: [MediaModule],
  controllers: [OcopController, OcopAdminController],
  providers: [OcopService],
  exports: [OcopService],
})
export class OcopModule {}
