import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { HarvestBatchesController } from './controllers/harvest-batches.controller';
import { HarvestTraceController } from './controllers/harvest-trace.controller';
import { GardenOwnerGuard } from './guards/garden-owner.guard';
import { HarvestBatchRepository } from './repositories/harvest-batch.repository';
import { HarvestBatchService } from './services/harvest-batch.service';

@Module({
  imports: [UsersModule, NotificationsModule, MediaModule],
  controllers: [HarvestBatchesController, HarvestTraceController],
  providers: [GardenOwnerGuard, HarvestBatchRepository, HarvestBatchService],
})
export class HarvestBatchesModule {}
