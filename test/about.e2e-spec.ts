import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Prisma, UserRole } from '../generated/prisma';
import { ABOUT_INITIAL_SNAPSHOT } from '../prisma/about-seed-data';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('About CMS (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const userIds: string[] = [];

  const cloneSnapshot = () => structuredClone(ABOUT_INITIAL_SNAPSHOT);

  async function login(label: string, role = UserRole.USER) {
    const zaloId = `about-${marker}-${label}`;
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

  function updateBody(
    mutate?: (snapshot: ReturnType<typeof cloneSnapshot>) => void,
  ) {
    const snapshot = cloneSnapshot();
    mutate?.(snapshot);
    return { version: 1, ...snapshot };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const snapshot = cloneSnapshot() as unknown as Prisma.InputJsonValue;
    await prisma.aboutRevision.deleteMany({ where: { aboutPageId: 'about' } });
    await prisma.aboutPage.upsert({
      where: { id: 'about' },
      update: {
        draftSnapshot: snapshot,
        publishedSnapshot: snapshot,
        version: 1,
        publishedVersion: 1,
        updatedById: null,
        publishedById: null,
        publishedAt: new Date('2026-07-15T10:00:00.000Z'),
      },
      create: {
        id: 'about',
        draftSnapshot: snapshot,
        publishedSnapshot: snapshot,
        version: 1,
        publishedVersion: 1,
        publishedAt: new Date('2026-07-15T10:00:00.000Z'),
      },
    });
    await prisma.aboutRevision.create({
      data: {
        aboutPageId: 'about',
        version: 1,
        snapshot,
        publishedAt: new Date('2026-07-15T10:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('returns only active published items in stable sort order and never draft data', async () => {
    const published = cloneSnapshot();
    published.statistics[0].sortOrder = 5;
    published.statistics[1].sortOrder = 1;
    published.statistics[2].sortOrder = 1;
    published.statistics[3].isActive = false;
    const draft = cloneSnapshot();
    draft.title = 'Draft must stay private';
    await prisma.aboutPage.update({
      where: { id: 'about' },
      data: {
        draftSnapshot: draft,
        publishedSnapshot: published,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/about')
      .expect(200);
    expect(response.body.data.title).toBe('Giới thiệu');
    expect(response.body.data.statistics).toHaveLength(3);
    const statistics = (
      response.body as { data: { statistics: Array<{ id: string }> } }
    ).data.statistics;
    expect(statistics.map((item) => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000101',
    ]);
    expect(response.headers.etag).toBe('"about-1"');
  });

  it('requires authentication and an admin role for admin APIs', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/about').expect(401);
    const user = await login('forbidden-user');
    await request(app.getHttpServer())
      .get('/api/v1/admin/about')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('saves a draft without changing the public response', async () => {
    const admin = await login('save-admin', UserRole.ADMIN);
    const before = await request(app.getHttpServer())
      .get('/api/v1/about')
      .expect(200);
    const saved = await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.title = 'Giới thiệu bản nháp';
        }),
      )
      .expect(200);
    expect(saved.body.data.version).toBe(2);
    expect(saved.body.data.hasUnpublishedChanges).toBe(true);
    const after = await request(app.getHttpServer())
      .get('/api/v1/about')
      .expect(200);
    expect(after.body.data).toEqual(before.body.data);
  });

  it('publishes once, updates public data and records revision/audit metadata', async () => {
    const admin = await login('publish-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.title = 'Giới thiệu đã xuất bản';
        }),
      )
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/admin/about/publish')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/admin/about/publish')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);

    const publicResponse = await request(app.getHttpServer())
      .get('/api/v1/about')
      .expect(200);
    expect(publicResponse.body.data.title).toBe('Giới thiệu đã xuất bản');
    expect(publicResponse.body.data.version).toBe(2);
    expect(
      await prisma.aboutRevision.count({
        where: { aboutPageId: 'about', version: 2 },
      }),
    ).toBe(1);
    const page = await prisma.aboutPage.findUniqueOrThrow({
      where: { id: 'about' },
    });
    expect(page.publishedById).toBe(admin.id);
    expect(
      await prisma.auditLog.count({
        where: { action: 'ABOUT_PUBLISHED', resourceId: 'about' },
      }),
    ).toBeGreaterThan(0);
  });

  it('returns 409 when two admins save the same version', async () => {
    const first = await login('conflict-first', UserRole.ADMIN);
    const second = await login('conflict-second', UserRole.ADMIN);
    await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${first.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.title = 'First';
        }),
      )
      .expect(200);
    const conflict = await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${second.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.title = 'Second';
        }),
      )
      .expect(409);
    expect(conflict.body.error.code).toBe('ABOUT_VERSION_CONFLICT');
    expect(conflict.body.error.details).toContainEqual({ latestVersion: 2 });
  });

  it('discards draft changes and restores the published snapshot', async () => {
    const admin = await login('discard-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.title = 'Discard me';
        }),
      )
      .expect(200);
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/about/discard-draft')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    expect(response.body.data.draft.title).toBe('Giới thiệu');
    expect(response.body.data.hasUnpublishedChanges).toBe(false);
  });

  it('rejects missing or unauthorized media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.hero.mediaId = randomUUID();
        }),
      )
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_ABOUT_MEDIA');

    const wrongTypeId = randomUUID();
    await prisma.media.create({
      data: {
        id: wrongTypeId,
        ownerId: admin.id,
        storageKey: `${wrongTypeId}.pdf`,
        originalUrl: `https://example.invalid/${wrongTypeId}.pdf`,
        mimeType: 'application/pdf',
        size: 100,
        checksum: wrongTypeId.replaceAll('-', ''),
      },
    });
    const wrongType = await request(app.getHttpServer())
      .put('/api/v1/admin/about')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        updateBody((snapshot) => {
          snapshot.hero.mediaId = wrongTypeId;
        }),
      )
      .expect(400);
    expect(wrongType.body.error.code).toBe('INVALID_ABOUT_MEDIA');
    await prisma.media.delete({ where: { id: wrongTypeId } });
  });

  it('does not replace the published snapshot when publish validation fails', async () => {
    const admin = await login('invalid-publish-admin', UserRole.ADMIN);
    const invalid = cloneSnapshot();
    invalid.title = '';
    await prisma.aboutPage.update({
      where: { id: 'about' },
      data: {
        draftSnapshot: invalid,
        version: 2,
      },
    });
    const before = await prisma.aboutPage.findUniqueOrThrow({
      where: { id: 'about' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/admin/about/publish')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
    const after = await prisma.aboutPage.findUniqueOrThrow({
      where: { id: 'about' },
    });
    expect(after.publishedSnapshot).toEqual(before.publishedSnapshot);
    expect(after.publishedVersion).toBe(1);
  });

  it('rolls back publish when revision creation fails', async () => {
    const admin = await login('rollback-admin', UserRole.ADMIN);
    const draft = cloneSnapshot();
    draft.title = 'Must not publish';
    await prisma.aboutPage.update({
      where: { id: 'about' },
      data: {
        draftSnapshot: draft,
        version: 2,
      },
    });
    await prisma.aboutRevision.create({
      data: {
        aboutPageId: 'about',
        version: 2,
        snapshot: draft,
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/admin/about/publish')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);
    const page = await prisma.aboutPage.findUniqueOrThrow({
      where: { id: 'about' },
    });
    expect(page.publishedVersion).toBe(1);
    expect((page.publishedSnapshot as { title: string }).title).toBe(
      'Giới thiệu',
    );
  });
});
