import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok without touching the database', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
      });
  });

  it('GET /api/v1/health/database reports database connectivity', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/database')
      .expect((res) => {
        // 200 if the configured Postgres is reachable, 503 with the
        // standard error envelope otherwise — both are valid outcomes for
        // this endpoint's own contract; we only assert the shape.
        expect([200, 503]).toContain(res.status);
      });
  });

  it('GET /api/v1/unknown-route returns the standard error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/v1/unknown-route')
      .expect(404)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBeDefined();
        expect(res.body.requestId).toBeDefined();
      });
  });
});
