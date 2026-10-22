import { type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RequestContextService } from '../src/common/context/request-context.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { TradeReviewsController } from '../src/modules/trade/reviews/controllers/trade-reviews.controller';
import { TradeReviewService } from '../src/modules/trade/reviews/services/trade-review.service';

describe('Trade review customer reply rate limit (e2e)', () => {
  let app: INestApplication<App>;
  const createCustomerReply = jest.fn().mockResolvedValue({
    id: 'reply-id',
    reviewId: 'review-id',
    userId: 'customer-id',
    content: 'Cảm ơn chủ tin.',
    createdAt: new Date('2026-10-21T03:00:00.000Z'),
    author: {
      id: 'customer-id',
      displayName: 'Khách hàng',
      avatarUrl: null,
    },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 1000 }],
        }),
      ],
      controllers: [TradeReviewsController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: TradeReviewService,
          useValue: { createCustomerReply },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(
      new HttpExceptionFilter({
        getRequestId: () => undefined,
      } as RequestContextService),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the standard 429 envelope after 10 replies per minute', async () => {
    for (let index = 0; index < 10; index++) {
      await request(app.getHttpServer())
        .post('/trade-posts/post-id/reviews/review-id/replies')
        .send({ content: 'Cảm ơn chủ tin.' })
        .expect(201);
    }

    const throttled = await request(app.getHttpServer())
      .post('/trade-posts/post-id/reviews/review-id/replies')
      .send({ content: 'Cảm ơn chủ tin.' })
      .expect(429);
    expect(throttled.body).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED' },
    });
    expect(createCustomerReply).toHaveBeenCalledTimes(10);
  });
});
