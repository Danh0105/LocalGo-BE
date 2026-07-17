import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { BusinessApplicationsAdminController } from './controllers/business-applications-admin.controller';
import { BusinessApplicationsController } from './controllers/business-applications.controller';
import { BusinessDocumentController } from './controllers/business-document.controller';
import { BusinessApplicationRepository } from './repositories/business-application.repository';
import { BusinessApplicationService } from './services/business-application.service';
import { BusinessDocumentAccessService } from './services/business-document-access.service';

@Module({
  imports: [MediaModule],
  controllers: [
    BusinessApplicationsController,
    BusinessApplicationsAdminController,
    BusinessDocumentController,
  ],
  providers: [
    BusinessApplicationRepository,
    BusinessApplicationService,
    BusinessDocumentAccessService,
  ],
  exports: [BusinessApplicationService],
})
export class BusinessApplicationsModule {}
