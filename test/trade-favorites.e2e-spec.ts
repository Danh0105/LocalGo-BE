import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { TradePostEventType, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  userId: string;
  token: string;
}

describe('Saving trade posts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const postPayload = {
    category: 'PRODUCT',
    title: 'Mãng cầu Bà Đen lưu tin e2e',
    summary: 'Mãng cầu chín cây',
    description: 'Mô tả',
    priceType: 'NEGOTIABLE',
    address: 'Tây Ninh',
    contactName: 'Nguyễn Văn A',
    contactPhone: '0901234567',
  };

  async function login(
    label: string,
    role: UserRole = UserRole.USER,
  ): Promise<AuthedUser> {
    const zaloId = `zalo-fav-${label}-${randomUUID()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.update({
      where: { zaloId },
      data: { role },
    });
    userIds.push(user.id);
    return { userId: user.id, token: res.body.data.accessToken as string };
  }

  const auth = (user: AuthedUser) => ({
    Authorization: `Bearer ${user.token}`,
  });

  async function publishedPost(): Promise<{
    owner: AuthedUser;
    admin: AuthedUser;
    postId: string;
  }> {
    const owner = await login('owner', UserRole.BUSINESS);
    const admin = await login('admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set(auth(owner))
      .send(postPayload)
      .expect(201);
    const postId = created.body.data.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${postId}/submit`)
      .set(auth(owner))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
      .set(auth(admin))
      .expect(200);
    return { owner, admin, postId };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    await prisma.tradePost.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('reports isSaved and saveCount for the signed-in viewer on public list and detail', async () => {
    const { owner, postId } = await publishedPost();
    const customer = await login('customer');

    const anonymous = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .expect(200);
    expect(anonymous.body.data).toMatchObject({ isSaved: false, saveCount: 0 });

    const saved = await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/save`)
      .set(auth(customer))
      .expect(201);
    expect(saved.body.data).toEqual({ saved: true, saveCount: 1 });
    // Idempotent.
    await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/save`)
      .set(auth(customer))
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .set(auth(customer))
      .expect(200);
    expect(detail.body.data).toMatchObject({ isSaved: true, saveCount: 1 });

    const list = await request(app.getHttpServer())
      .get('/api/v1/trade-posts')
      .query({ ownerId: owner.userId })
      .set(auth(customer))
      .expect(200);
    expect(list.body.data[0]).toMatchObject({ id: postId, isSaved: true });

    // Someone else's view of the same post is not "saved".
    const otherViewer = await login('other-viewer');
    const otherList = await request(app.getHttpServer())
      .get('/api/v1/trade-posts')
      .query({ ownerId: owner.userId })
      .set(auth(otherViewer))
      .expect(200);
    expect(otherList.body.data[0].isSaved).toBe(false);

    // A bad token on a public route is treated as anonymous, not rejected.
    const badToken = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(200);
    expect(badToken.body.data.isSaved).toBe(false);

    await request(app.getHttpServer())
      .delete(`/api/v1/trade-posts/${postId}/save`)
      .set(auth(customer))
      .expect(204);
    const after = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .set(auth(customer))
      .expect(200);
    expect(after.body.data).toMatchObject({ isSaved: false, saveCount: 0 });
  });

  it('attributes a signed-in detail view to the viewer', async () => {
    const { postId } = await publishedPost();
    const viewer = await login('attributed-viewer');
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${postId}`)
      .set(auth(viewer))
      .expect(200);
    const views = await prisma.tradePostEvent.count({
      where: {
        tradePostId: postId,
        type: TradePostEventType.VIEW,
        userId: viewer.userId,
      },
    });
    expect(views).toBe(1);
  });

  it('requires login to save and only saves publicly visible posts', async () => {
    const { owner } = await publishedPost();
    const customer = await login('gate-customer');
    const draft = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set(auth(owner))
      .send(postPayload)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${draft.body.data.id}/save`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${draft.body.data.id}/save`)
      .set(auth(customer))
      .expect(404);
  });

  it('keeps hidden posts in the saved list as unavailable and drops deleted ones', async () => {
    const { admin, postId } = await publishedPost();
    const { postId: deletedId } = await publishedPost();
    const customer = await login('saved-list-customer');
    for (const id of [postId, deletedId]) {
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${id}/save`)
        .set(auth(customer))
        .expect(201);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/hide`)
      .set(auth(admin))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/trade-posts/${deletedId}`)
      .set(auth(admin))
      .expect(204);

    const savedList = await request(app.getHttpServer())
      .get('/api/v1/trade-posts/me/saved')
      .set(auth(customer))
      .expect(200);
    expect(savedList.body.meta.total).toBe(1);
    expect(savedList.body.data[0]).toMatchObject({
      id: postId,
      status: 'HIDDEN',
      isSaved: true,
      isAvailable: false,
    });
    expect(savedList.body.data[0].savedAt).toEqual(expect.any(String));

    // Unsaving still works for a post that is no longer public.
    await request(app.getHttpServer())
      .delete(`/api/v1/trade-posts/${postId}/save`)
      .set(auth(customer))
      .expect(204);
    const empty = await request(app.getHttpServer())
      .get('/api/v1/trade-posts/me/saved')
      .set(auth(customer))
      .expect(200);
    expect(empty.body.meta.total).toBe(0);
  });

  it('notifies the owner only the first time a user saves the post', async () => {
    const { owner, postId } = await publishedPost();
    const customer = await login('toggler');
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/save`)
        .set(auth(customer))
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/v1/trade-posts/${postId}/save`)
        .set(auth(customer))
        .expect(204);
    }
    const notifications = await prisma.notification.count({
      where: { userId: owner.userId, type: 'TRADE_POST_SAVED' },
    });
    expect(notifications).toBe(1);
  });
});
