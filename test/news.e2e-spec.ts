import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { NewsCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('News (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `news-${marker}`;
  const userIds: string[] = [];

  const ids = {
    older: `${prefix}-older`,
    newer: `${prefix}-newer`,
    hidden: `${prefix}-hidden`,
    scheduled: `${prefix}-scheduled`,
  };

  const now = Date.now();
  const olderDate = new Date(now - 1000 * 60 * 60 * 24 * 3);
  const newerDate = new Date(now - 1000 * 60 * 60 * 24);
  const futureDate = new Date(now + 1000 * 60 * 60 * 24 * 30);

  async function login(label: string, role = UserRole.USER) {
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

  function body(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Bài Viết Kiểm Thử',
      category: 'Thông báo',
      publishedAt: olderDate.toISOString(),
      author: 'Tác giả kiểm thử',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      content: ['Đoạn nội dung kiểm thử.'],
      tags: ['kiểm thử'],
      relatedLinks: ['Giới thiệu'],
      mediaId: null,
      imageAlt: 'Bài Viết Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.newsArticle.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.newsArticle.createMany({
      data: [
        {
          id: ids.older,
          title: 'Bài Cũ Hơn',
          category: NewsCategory.THONG_BAO,
          publishedAt: olderDate,
          author: 'Tác giả A',
          summary: 'Tóm tắt A',
          content: ['Mô tả A'],
          tags: ['A'],
          relatedLinks: ['Liên hệ'],
          isActive: true,
        },
        {
          id: ids.newer,
          title: 'Bài Mới Hơn',
          category: NewsCategory.DU_LICH,
          publishedAt: newerDate,
          author: 'Tác giả B',
          summary: 'Tóm tắt B',
          content: ['Mô tả B'],
          tags: ['B'],
          relatedLinks: ['Bản đồ'],
          isActive: true,
        },
        {
          id: ids.hidden,
          title: 'Bài Đang Ẩn',
          category: NewsCategory.HOAT_DONG_XA,
          publishedAt: olderDate,
          author: 'Tác giả C',
          summary: 'Tóm tắt C',
          content: ['Mô tả C'],
          tags: ['C'],
          relatedLinks: ['Lễ hội'],
          isActive: false,
        },
        {
          id: ids.scheduled,
          title: 'Bài Lên Lịch Tương Lai',
          category: NewsCategory.NONG_NGHIEP,
          publishedAt: futureDate,
          author: 'Tác giả D',
          summary: 'Tóm tắt D',
          content: ['Mô tả D'],
          tags: ['D'],
          relatedLinks: ['Nông nghiệp'],
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.newsArticle.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('public list excludes hidden and scheduled-future records, sorts by publishedAt desc', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/news')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.newer, ids.older]);
  });

  it('public list filters by category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/news')
      .query({ category: 'Du lịch' })
      .expect(200);
    const items = (response.body as { data: Array<{ id: string }> }).data;
    expect(items.filter((item) => item.id.startsWith(prefix))).toHaveLength(1);
  });

  it('public detail returns 404 for missing, hidden, or scheduled-future articles', async () => {
    for (const id of [ids.hidden, ids.scheduled, `${prefix}-missing`]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/news/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('NEWS_ARTICLE_NOT_FOUND');
    }
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/news').expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/news')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('admin list still sees hidden and scheduled-future articles', async () => {
    const admin = await login('list-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const items = (response.body as { data: Array<{ id: string }> }).data;
    const own = items.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual(
      expect.arrayContaining([ids.hidden, ids.scheduled]),
    );
  });

  it('generates a stable slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ title: `Bài Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.older }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('NEWS_ARTICLE_SLUG_EXISTS');
  });

  it('rejects an unparseable publishedAt value', async () => {
    const admin = await login('date-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-bad-date`,
          publishedAt: 'not-a-real-date',
        }),
      )
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows scheduling a future publishedAt via admin create', async () => {
    const admin = await login('schedule-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-newly-scheduled`,
          publishedAt: futureDate.toISOString(),
        }),
      )
      .expect(201);
    expect(created.body.data.isActive).toBe(true);
    await request(app.getHttpServer())
      .get(`/api/v1/news/${prefix}-newly-scheduled`)
      .expect(404);
  });

  it('updates and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);

    await request(app.getHttpServer())
      .put(`/api/v1/admin/news/${ids.older}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, title: 'Bài Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/news/${ids.older}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, title: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('NEWS_ARTICLE_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.title).toBe('Bài Đã Cập Nhật');
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/news/${ids.older}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/news/${ids.older}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/news/${ids.newer}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.newsArticle.findUnique({ where: { id: ids.newer } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-missing-media`, mediaId: randomUUID() }))
      .expect(400);

    const mediaId = randomUUID();
    await prisma.media.create({
      data: {
        id: mediaId,
        ownerId: admin.id,
        storageKey: `${prefix}-${mediaId}.pdf`,
        originalUrl: `https://example.invalid/${mediaId}.pdf`,
        mimeType: 'application/pdf',
        size: 10,
        checksum: mediaId.replaceAll('-', ''),
      },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/news')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_NEWS_ARTICLE_MEDIA');
  });
});
