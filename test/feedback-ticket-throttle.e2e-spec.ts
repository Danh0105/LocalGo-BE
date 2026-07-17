import { type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FeedbackTicketsController } from '../src/modules/feedback/controllers/feedback-tickets.controller';
import { FeedbackTicketService } from '../src/modules/feedback/services/feedback-ticket.service';

/**
 * The full AppModule disables ThrottlerGuard in NODE_ENV=test (see
 * app.module.ts) so the e2e suite can log in many test fixtures rapidly.
 * That means the shared createTestApp() harness can never observe a real
 * 429 from any endpoint. To still verify the submit endpoint's per-IP
 * rate limit for real, this spec boots a minimal Nest app that mounts only
 * the ticket controller behind an un-skipped ThrottlerGuard.
 */
describe('Feedback ticket submission rate limit (e2e)', () => {
  let app: INestApplication<App>;
  const submit = jest
    .fn()
    .mockResolvedValue({ success: true, ticketCode: 'PH-TEST01' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 1000 }],
        }),
      ],
      controllers: [FeedbackTicketsController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: FeedbackTicketService, useValue: { submit } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests beyond the 5/min per-IP limit configured on the submit endpoint', async () => {
    const payload = {
      fullName: 'Nguyễn Văn A',
      phone: '0900123456',
      content: 'Nội dung phản hồi kiểm thử độ dài hợp lệ.',
    };
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/feedback/tickets')
        .send(payload)
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/feedback/tickets')
      .send(payload)
      .expect(429);
    expect(submit).toHaveBeenCalledTimes(5);
  });
});
