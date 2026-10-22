import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FestivalCategory, TempleType, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Content reviews (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `content-review-${marker}`;
  const userIds: string[] = [];

  const ids = {
    temple: `${prefix}-temple`,
    hiddenTemple: `${prefix}-hidden-temple`,
    festival: `${prefix}-festival`,
  };

  type Session = { id: string; token: string };
  let alice: Session;
  let bob: Session;
  let moderator: Session;
  let aliceReviewId: string;
  let bobReviewId: string;
  let bobImageId: string;

  async function login(label: string, role = UserRole.USER): Promise<Session> {
    const zaloId = `${prefix}-${label}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { zaloId } });
    userIds.push(user.id);
    if (role !== UserRole.USER) {
      await prisma.user.update({ where: { id: user.id }, data: { role } });
    }
    return { id: user.id, token: response.body.data.accessToken as string };
  }

  async function createImage(ownerId: string, label: string) {
    const storageKey = `${prefix}-${label}.webp`;
    const media = await prisma.media.create({
      data: {
        ownerId,
        storageKey,
        originalUrl: `/uploads/images/${storageKey}`,
        mimeType: 'image/webp',
        size: 100,
        checksum: `${prefix}-${label}`,
      },
    });
    return media.id;
  }

  const api = () => request(app.getHttpServer());
  const itemIds = (body: unknown) =>
    (body as { data: Array<{ id: string }> }).data.map((item) => item.id);
  const auth = (session: Session) => `Bearer ${session.token}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.temple.createMany({
      data: [
        {
          id: ids.temple,
          name: 'Chùa Kiểm Thử Đánh Giá',
          type: TempleType.CHUA,
          address: 'Địa chỉ A',
          openHours: '05:00 - 18:00',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          isActive: true,
        },
        {
          id: ids.hiddenTemple,
          name: 'Miếu Đang Ẩn',
          type: TempleType.MIEU,
          address: 'Địa chỉ B',
          openHours: '05:00 - 18:00',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          isActive: false,
        },
      ],
    });
    await prisma.festival.create({
      data: {
        id: ids.festival,
        name: 'Lễ Hội Kiểm Thử',
        category: FestivalCategory.LE_TRUYEN_THONG,
        time: 'Tháng 3 âm lịch',
        location: 'Xã Kiểm Thử',
        scale: 'Cấp xã',
        summary: 'Tóm tắt lễ hội',
        description: ['Mô tả lễ hội'],
        activities: ['Hoạt động'],
        note: '',
      },
    });

    alice = await login('alice');
    bob = await login('bob');
    moderator = await login('moderator', UserRole.MODERATOR);
  });

  afterAll(async () => {
    await prisma.contentReview.deleteMany({
      where: { targetId: { startsWith: prefix } },
    });
    await prisma.temple.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.festival.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects unknown sections and hidden or missing items', async () => {
    const unknown = await api()
      .get(`/api/v1/content-reviews/ocop/${ids.temple}`)
      .expect(404);
    expect(unknown.body.error.code).toBe('CONTENT_REVIEW_TARGET_NOT_FOUND');

    for (const id of [ids.hiddenTemple, `${prefix}-missing`]) {
      const response = await api()
        .post(`/api/v1/content-reviews/temples/${id}`)
        .set('Authorization', auth(alice))
        .send({ rating: 5, content: 'Đẹp' })
        .expect(404);
      expect(response.body.error.code).toBe('CONTENT_REVIEW_TARGET_NOT_FOUND');
    }

    await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .send({ rating: 5, content: 'Đẹp' })
      .expect(401);
  });

  it('validates rating and content', async () => {
    for (const payload of [
      { rating: 0, content: 'Đẹp' },
      { rating: 6, content: 'Đẹp' },
      { rating: 4, content: '   ' },
      { rating: 4, content: 'x'.repeat(1001) },
    ]) {
      await api()
        .post(`/api/v1/content-reviews/temples/${ids.temple}`)
        .set('Authorization', auth(alice))
        .send(payload)
        .expect(400);
    }
  });

  it('creates one review per user per item', async () => {
    const created = await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .set('Authorization', auth(alice))
      .send({ rating: 5, content: '  Cảnh chùa rất đẹp, yên bình.  ' })
      .expect(201);
    expect(created.body.data).toMatchObject({
      targetType: 'temples',
      targetId: ids.temple,
      userId: alice.id,
      rating: 5,
      content: 'Cảnh chùa rất đẹp, yên bình.',
      status: 'PUBLISHED',
      replyContent: null,
      images: [],
      reviewer: { id: alice.id },
    });
    aliceReviewId = created.body.data.id as string;

    const duplicate = await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .set('Authorization', auth(alice))
      .send({ rating: 1, content: 'Lần hai' })
      .expect(409);
    expect(duplicate.body.error.code).toBe('REVIEW_ALREADY_EXISTS');

    // Same user, different section: independent.
    await api()
      .post(`/api/v1/content-reviews/festivals/${ids.festival}`)
      .set('Authorization', auth(alice))
      .send({ rating: 4, content: 'Lễ hội vui' })
      .expect(201);

    const staffNotifications = await prisma.notification.findMany({
      where: {
        userId: moderator.id,
        type: 'CONTENT_REVIEW_SUBMITTED',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(staffNotifications).toHaveLength(2);
    expect(staffNotifications[0].data).toEqual({
      reviewId: aliceReviewId,
      targetType: 'temples',
      targetId: ids.temple,
      submittedById: alice.id,
    });
  });

  it('accepts only the caller’s own image uploads', async () => {
    const aliceImageId = await createImage(alice.id, 'alice-image');
    const foreign = await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .set('Authorization', auth(bob))
      .send({ rating: 3, content: 'Bình thường', imageIds: [aliceImageId] })
      .expect(400);
    expect(foreign.body.error.code).toBe('INVALID_CONTENT_REVIEW_MEDIA');

    bobImageId = await createImage(bob.id, 'bob-image');
    const created = await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .set('Authorization', auth(bob))
      .send({ rating: 3, content: 'Bình thường', imageIds: [bobImageId] })
      .expect(201);
    expect(created.body.data.images).toEqual([
      expect.objectContaining({ id: bobImageId, sortOrder: 0 }),
    ]);
    bobReviewId = created.body.data.id as string;
  });

  it('lists, summarizes and rates published reviews publicly', async () => {
    const list = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}`)
      .expect(200);
    expect(list.body.meta).toMatchObject({ total: 2, page: 1 });
    expect(itemIds(list.body)).toEqual([bobReviewId, aliceReviewId]);
    expect(list.body.data[0].reviewer).not.toHaveProperty('email');

    const summary = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}/summary`)
      .expect(200);
    expect(summary.body.data).toEqual({
      average: 4,
      total: 2,
      counts: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 1 },
      distribution: { '1': 0, '2': 0, '3': 50, '4': 0, '5': 50 },
    });

    const ratings = await api()
      .get('/api/v1/content-reviews/ratings')
      .query({
        targetType: 'temples',
        ids: `${ids.temple},${ids.hiddenTemple}`,
      })
      .expect(200);
    expect(ratings.body.data).toEqual([
      { targetId: ids.temple, average: 4, total: 2 },
      { targetId: ids.hiddenTemple, average: 0, total: 0 },
    ]);
  });

  it('returns the caller’s own reviews', async () => {
    const mine = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}/me`)
      .set('Authorization', auth(alice))
      .expect(200);
    expect(mine.body.data.id).toBe(aliceReviewId);

    const none = await api()
      .get(`/api/v1/content-reviews/festivals/${ids.festival}/me`)
      .set('Authorization', auth(bob))
      .expect(200);
    expect(none.body.data).toBeNull();

    const all = await api()
      .get('/api/v1/content-reviews/me')
      .set('Authorization', auth(alice))
      .expect(200);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: aliceReviewId,
          target: {
            targetType: 'temples',
            id: ids.temple,
            name: 'Chùa Kiểm Thử Đánh Giá',
            imageUrl: null,
            isActive: true,
            deleted: false,
          },
        }),
      ]),
    );
  });

  it('lets only the author edit or delete a review', async () => {
    await api()
      .patch(`/api/v1/content-reviews/${aliceReviewId}`)
      .set('Authorization', auth(bob))
      .send({ rating: 1 })
      .expect(403);
    await api()
      .delete(`/api/v1/content-reviews/${aliceReviewId}`)
      .set('Authorization', auth(moderator))
      .expect(403);

    const updated = await api()
      .patch(`/api/v1/content-reviews/${aliceReviewId}`)
      .set('Authorization', auth(alice))
      .send({ rating: 4 })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      rating: 4,
      content: 'Cảnh chùa rất đẹp, yên bình.',
    });

    const summary = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}/summary`)
      .expect(200);
    expect(summary.body.data.average).toBe(3.5);
  });

  it('restricts admin endpoints to moderators', async () => {
    await api().get('/api/v1/admin/content-reviews').expect(401);
    await api()
      .get('/api/v1/admin/content-reviews')
      .set('Authorization', auth(alice))
      .expect(403);
  });

  it('hides, re-shows and replies to reviews as the admin team', async () => {
    const hidden = await api()
      .patch(`/api/v1/admin/content-reviews/${bobReviewId}/status`)
      .set('Authorization', auth(moderator))
      .send({ status: 'HIDDEN' })
      .expect(200);
    expect(hidden.body.data.status).toBe('HIDDEN');

    const list = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}`)
      .expect(200);
    expect(list.body.meta.total).toBe(1);

    const rejected = await api()
      .put(`/api/v1/admin/content-reviews/${bobReviewId}/reply`)
      .set('Authorization', auth(moderator))
      .send({ content: 'Cảm ơn bạn' })
      .expect(409);
    expect(rejected.body.error.code).toBe('REVIEW_REPLY_NOT_ALLOWED');

    // An author's edit does not re-publish a hidden review.
    const edited = await api()
      .patch(`/api/v1/content-reviews/${bobReviewId}`)
      .set('Authorization', auth(bob))
      .send({ content: 'Đã sửa' })
      .expect(200);
    expect(edited.body.data.status).toBe('HIDDEN');

    await api()
      .patch(`/api/v1/admin/content-reviews/${bobReviewId}/status`)
      .set('Authorization', auth(moderator))
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const replied = await api()
      .put(`/api/v1/admin/content-reviews/${bobReviewId}/reply`)
      .set('Authorization', auth(moderator))
      .send({ content: '  Cảm ơn bạn đã ghé thăm!  ' })
      .expect(200);
    expect(replied.body.data).toMatchObject({
      replyContent: 'Cảm ơn bạn đã ghé thăm!',
      repliedBy: { id: moderator.id },
    });

    const publicList = await api()
      .get(`/api/v1/content-reviews/temples/${ids.temple}`)
      .expect(200);
    const bobPublic = (
      publicList.body as { data: Array<{ id: string; replyContent: string }> }
    ).data.find((item) => item.id === bobReviewId);
    expect(bobPublic?.replyContent).toBe('Cảm ơn bạn đã ghé thăm!');
    expect(bobPublic).not.toHaveProperty('repliedBy');

    const notifications = await prisma.notification.findMany({
      where: { userId: bob.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications.map((item) => item.type)).toEqual([
      'CONTENT_REVIEW_HIDDEN',
      'CONTENT_REVIEW_UNHIDDEN',
      'CONTENT_REVIEW_REPLIED',
    ]);
    expect(notifications[2].data).toEqual({
      reviewId: bobReviewId,
      targetType: 'temples',
      targetId: ids.temple,
    });
  });

  it('lists, filters and counts reviews for admins', async () => {
    const list = await api()
      .get('/api/v1/admin/content-reviews')
      .query({ targetType: 'temples', targetId: ids.temple })
      .set('Authorization', auth(moderator))
      .expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.data[0]).toMatchObject({
      target: { name: 'Chùa Kiểm Thử Đánh Giá', deleted: false },
      user: { id: bob.id, status: 'ACTIVE' },
    });

    const search = await api()
      .get('/api/v1/admin/content-reviews')
      .query({ search: 'yên bình', targetId: ids.temple })
      .set('Authorization', auth(moderator))
      .expect(200);
    expect(itemIds(search.body)).toEqual([aliceReviewId]);

    const stats = await api()
      .get('/api/v1/admin/content-reviews/stats')
      .query({ targetType: 'temples', targetId: ids.temple })
      .set('Authorization', auth(moderator))
      .expect(200);
    expect(stats.body.data).toMatchObject({
      total: 2,
      byStatus: { PUBLISHED: 2, HIDDEN: 0 },
      unreplied: 1,
    });
    expect(stats.body.data.byTargetType).toMatchObject({
      temples: 2,
      festivals: 0,
    });
  });

  it('allows a new review after the old one is deleted', async () => {
    await api()
      .delete(`/api/v1/content-reviews/${aliceReviewId}`)
      .set('Authorization', auth(alice))
      .expect(204);
    await api()
      .get(`/api/v1/admin/content-reviews/${aliceReviewId}`)
      .set('Authorization', auth(moderator))
      .expect(404);

    await api()
      .post(`/api/v1/content-reviews/temples/${ids.temple}`)
      .set('Authorization', auth(alice))
      .send({ rating: 2, content: 'Viết lại đánh giá' })
      .expect(201);
  });

  it('notifies the author when an admin deletes a review', async () => {
    const festivalReview = await prisma.contentReview.findFirstOrThrow({
      where: { targetId: ids.festival, userId: alice.id },
    });
    await api()
      .delete(`/api/v1/admin/content-reviews/${festivalReview.id}`)
      .set('Authorization', auth(moderator))
      .expect(204);
    const notification = await prisma.notification.findFirst({
      where: { userId: alice.id, type: 'CONTENT_REVIEW_DELETED' },
    });
    expect(notification?.body).toContain('Lễ Hội Kiểm Thử');
  });

  it('purges an item’s reviews and their images when the item is deleted', async () => {
    await api()
      .delete(`/api/v1/admin/temples/${ids.temple}`)
      .set('Authorization', auth(moderator))
      .expect(204);

    expect(
      await prisma.contentReview.count({ where: { targetId: ids.temple } }),
    ).toBe(0);
    const image = await prisma.media.findUniqueOrThrow({
      where: { id: bobImageId },
    });
    expect(image.deletedAt).not.toBeNull();
  });
});
