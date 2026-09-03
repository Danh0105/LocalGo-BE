import { Module } from '@nestjs/common';
import { ZaloOaMessagingService } from './services/zalo-oa-messaging.service';

@Module({
  providers: [ZaloOaMessagingService],
  exports: [ZaloOaMessagingService],
})
export class ZaloModule {}
