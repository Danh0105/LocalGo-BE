import { Module } from '@nestjs/common';
import { AboutAdminController } from './controllers/about-admin.controller';
import { AboutController } from './controllers/about.controller';
import { AboutRepository } from './repositories/about.repository';
import { AboutService } from './services/about.service';

@Module({
  controllers: [AboutController, AboutAdminController],
  providers: [AboutRepository, AboutService],
  exports: [AboutService],
})
export class AboutModule {}
