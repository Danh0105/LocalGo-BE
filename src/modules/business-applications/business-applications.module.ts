import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessApplicationsAdminController } from './controllers/business-applications-admin.controller';
import { BusinessApplicationsController } from './controllers/business-applications.controller';
import { BusinessProfilesAdminController } from './controllers/business-profiles-admin.controller';
import { BusinessProfilesController } from './controllers/business-profiles.controller';
import { BusinessDocumentController } from './controllers/business-document.controller';
import { BusinessApplicationRepository } from './repositories/business-application.repository';
import { BusinessApplicationService } from './services/business-application.service';
import { BusinessDocumentAccessService } from './services/business-document-access.service';
import { BusinessProfileService } from './services/business-profile.service';

@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [
    BusinessApplicationsController,
    BusinessApplicationsAdminController,
    BusinessDocumentController,
    BusinessProfilesController,
    BusinessProfilesAdminController,
  ],
  providers: [
    BusinessApplicationRepository,
    BusinessApplicationService,
    BusinessDocumentAccessService,
    BusinessProfileService,
  ],
  exports: [BusinessApplicationService],
})
export class BusinessApplicationsModule {}
