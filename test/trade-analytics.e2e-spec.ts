import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  zaloId: string;
  userId: string;
  accessToken: string;
}

describe('Trade post analytics & engagement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdZaloIds: string[] = [];

  async function loginAsNewUser(label: string): Promise<AuthedUser> {
    const zaloId = `zalo-an-${label}-${randomUUID()}`;
    createdZaloIds.push(zaloId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { zaloId } });
    return {
      zaloId,
      userId: user.id,
      accessToken: res.body.data.accessToken as string,
    };
  }

  async function setRole(userId: string, role: UserRole): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { role } });
  }

  const basePayload = {
    category: 'PRODUCT',
    title: 'Analytics test post',
    summary: 'San pham phuc vu kiem thu thong ke',
    description: 'Mo ta chi tiet cho tin kiem thu thong ke truy cap',
    priceType: 'FIXED',
    price: 12000,
    address: 'Xa Truong Mit, Tay Ninh',
    contactName: 'Nguyen Van B',
    contactPhone: '0907654321',
  };

  async function createPublishedPost(
    owner: AuthedUser,
    admin: AuthedUser,
  ): Promise<string> {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ ...basePayload, title: `Analytics post ${randomUUID()}` })
      .expect(201);
    const postId: string = createRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${postId}/submit`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    return postId;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    const users = await prisma.user.findMany({
      where: { zaloId: { in: createdZaloIds } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    // SavedTradePost.userId cascades on user delete; TradePostEvent.tradePostId
    // cascades on post delete. Clear children before the Restrict-guarded posts
    // and users.
    await prisma.savedTradePost.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.tradeReview.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tradePost.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('records views and interactions, then surfaces them in owner analytics', async () => {
    const owner = await loginAsNewUser('owner');
    await setRole(owner.userId, UserRole.BUSINESS);
    const admin = await loginAsNewUser('admin');
    await setRole(admin.userId, UserRole.ADMIN);

    const postId = await createPublishedPost(owner, admin);

    // Two public detail views bump viewCount and log VIEW events. Note the
    // response reflects the pre-increment count, so we assert the persisted
    // counter afterwards rather than the returned value.
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .expect(200);

    const persisted = await prisma.tradePost.findUniqueOrThrow({
      where: { id: postId },
      select: { viewCount: true },
    });
    expect(persisted.viewCount).toBe(2);

    const viewEvents = await prisma.tradePostEvent.count({
      where: { tradePostId: postId, type: 'VIEW' },
    });
    expect(viewEvents).toBe(2);

    // Explicit interactions (public endpoint).
    for (const type of ['CONTACT_PHONE', 'CONTACT_ZALO', 'SHARE'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/interactions`)
        .send({ type })
        .expect(204);
    }

    // Invalid interaction type is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/interactions`)
      .send({ type: 'VIEW' })
      .expect(400);

    // Owner sees the aggregated totals for their own posts.
    const summary = await request(app.getHttpServer())
      .get('/api/v1/trade-posts/me/analytics')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(summary.body.data.totals.views).toBeGreaterThanOrEqual(2);
    expect(summary.body.data.totals.contactPhone).toBe(1);
    expect(summary.body.data.totals.contactZalo).toBe(1);
    expect(summary.body.data.totals.share).toBe(1);
    expect(summary.body.data.totals.uniqueVisitors).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.postCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(summary.body.data.timeseries)).toBe(true);

    // Per-post analytics for the owner, with a daily time-series.
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}/analytics`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(detail.body.data.post.id).toBe(postId);
    expect(detail.body.data.totals.views).toBeGreaterThanOrEqual(2);
    const seriesViews = (
      detail.body.data.timeseries as Array<{ views: number }>
    ).reduce((sum, point) => sum + point.views, 0);
    expect(seriesViews).toBeGreaterThanOrEqual(2);
  });

  it('saves/unsaves a post idempotently and lists saved posts', async () => {
    const owner = await loginAsNewUser('save-owner');
    await setRole(owner.userId, UserRole.BUSINESS);
    const admin = await loginAsNewUser('save-admin');
    await setRole(admin.userId, UserRole.ADMIN);
    const saver = await loginAsNewUser('saver');

    const postId = await createPublishedPost(owner, admin);

    const firstSave = await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/save`)
      .set('Authorization', `Bearer ${saver.accessToken}`)
      .expect(201);
    expect(firstSave.body.data).toEqual({ saved: true, saveCount: 1 });

    // Saving again is idempotent — count stays 1.
    const secondSave = await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/save`)
      .set('Authorization', `Bearer ${saver.accessToken}`)
      .expect(201);
    expect(secondSave.body.data.saveCount).toBe(1);

    const saveEvents = await prisma.tradePostEvent.count({
      where: { tradePostId: postId, type: 'SAVE' },
    });
    expect(saveEvents).toBe(1);

    const saved = await request(app.getHttpServer())
      .get('/api/v1/trade-posts/me/saved')
      .set('Authorization', `Bearer ${saver.accessToken}`)
      .expect(200);
    expect(
      (saved.body.data as Array<{ id: string }>).map((p) => p.id),
    ).toContain(postId);

    await request(app.getHttpServer())
      .delete(`/api/v1/trade-posts/${postId}/save`)
      .set('Authorization', `Bearer ${saver.accessToken}`)
      .expect(204);

    const post = await prisma.tradePost.findUniqueOrThrow({
      where: { id: postId },
      select: { saveCount: true },
    });
    expect(post.saveCount).toBe(0);

    const savedAfter = await request(app.getHttpServer())
      .get('/api/v1/trade-posts/me/saved')
      .set('Authorization', `Bearer ${saver.accessToken}`)
      .expect(200);
    expect(
      (savedAfter.body.data as Array<{ id: string }>).map((p) => p.id),
    ).not.toContain(postId);
  });

  it('enforces authorization on per-post analytics and exposes admin summary', async () => {
    const owner = await loginAsNewUser('auth-owner');
    await setRole(owner.userId, UserRole.BUSINESS);
    const admin = await loginAsNewUser('auth-admin');
    await setRole(admin.userId, UserRole.ADMIN);
    const stranger = await loginAsNewUser('auth-stranger');
    await setRole(stranger.userId, UserRole.BUSINESS);

    const postId = await createPublishedPost(owner, admin);

    // A different business user cannot read another owner's post analytics.
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}/analytics`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .expect(403);

    // Admin can read any post's analytics and the platform summary.
    await request(app.getHttpServer())
      .get(`/api/v1/admin/trade-posts/${postId}/analytics`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const adminSummary = await request(app.getHttpServer())
      .get('/api/v1/admin/trade-posts/analytics/summary')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(adminSummary.body.data.totals).toHaveProperty('views');

    // A non-admin cannot reach the admin summary.
    await request(app.getHttpServer())
      .get('/api/v1/admin/trade-posts/analytics/summary')
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .expect(403);
  });
});
