import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { FeedbackChannelsAdminController } from './controllers/feedback-channels-admin.controller';
import { FeedbackChannelsController } from './controllers/feedback-channels.controller';
import { FeedbackTicketsAdminController } from './controllers/feedback-tickets-admin.controller';
import { FeedbackTicketsController } from './controllers/feedback-tickets.controller';
import { FeedbackChannelService } from './services/feedback-channel.service';
import { FeedbackTicketService } from './services/feedback-ticket.service';

@Module({
  imports: [MediaModule],
  controllers: [
    FeedbackChannelsController,
    FeedbackChannelsAdminController,
    FeedbackTicketsController,
    FeedbackTicketsAdminController,
  ],
  providers: [FeedbackChannelService, FeedbackTicketService],
  exports: [FeedbackChannelService, FeedbackTicketService],
})
export class FeedbackModule {}
