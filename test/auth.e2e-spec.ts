import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Zalo login (mock provider)', () => {
    it('creates a new user on first login and returns tokens', async () => {
      const zaloId = `zalo-${randomUUID()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/zalo')
        .send({ accessToken: `mock:${zaloId}:Nguyen Van Test` })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');

      const user = await prisma.user.findUnique({ where: { zaloId } });
      expect(user).not.toBeNull();

      await prisma.user.delete({ where: { zaloId } });
    });

    it('rejects a malformed mock access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/zalo')
        .send({ accessToken: 'not-a-valid-mock-token' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('login -> refresh -> reuse detection', () => {
    const zaloId = `zalo-flow-${randomUUID()}`;

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { zaloId } });
    });

    it('rotates the refresh token on refresh, then detects replay of the old token and revokes the family', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/zalo')
        .send({ accessToken: `mock:${zaloId}:Flow Test User` })
        .expect(201);

      const firstRefreshToken: string = loginRes.body.data.refreshToken;

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(201);
      const secondRefreshToken: string = refreshRes.body.data.refreshToken;
      expect(secondRefreshToken).not.toEqual(firstRefreshToken);

      // Replaying the already-rotated-away token must be rejected...
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(401);

      // ...and must have revoked the whole family: the second (otherwise
      // still-valid) token must now ALSO be rejected.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: secondRefreshToken })
        .expect(401);
    });
  });

  describe('logout / logout-all', () => {
    const zaloId = `zalo-logout-${randomUUID()}`;

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { zaloId } });
    });

    it('logout revokes the current session so its refresh token stops working', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/zalo')
        .send({ accessToken: `mock:${zaloId}:Logout Test` })
        .expect(201);
      const refreshToken: string = loginRes.body.data.refreshToken;

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('RBAC', () => {
    it('rejects a USER-role token on an admin-only route', async () => {
      const zaloId = `zalo-rbac-${randomUUID()}`;
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/zalo')
        .send({ accessToken: `mock:${zaloId}:RBAC Test User` })
        .expect(201);
      const accessToken: string = loginRes.body.data.accessToken;

      await request(app.getHttpServer())
        .get('/api/v1/admin/trade-posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      await prisma.user.deleteMany({ where: { zaloId } });
    });

    it('rejects requests with no token on a protected route', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('allows a Public()-marked route with no token', async () => {
      await request(app.getHttpServer()).get('/api/v1/trade-posts').expect(200);
    });
  });
});
