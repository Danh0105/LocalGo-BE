import { Module } from '@nestjs/common';
import { SessionsController } from './controllers/sessions.controller';
import { SessionRepository } from './repositories/session.repository';
import { SessionService } from './services/session.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionRepository, SessionService],
  exports: [SessionService],
})
export class SessionsModule {}
