import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MapPlaceCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Map places (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `map-place-${marker}`;
  const userIds: string[] = [];

  const ids = {
    first: `${prefix}-first`,
    second: `${prefix}-second`,
    hidden: `${prefix}-hidden`,
  };

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
      name: 'Điểm Kiểm Thử',
      category: 'Hành chính',
      address: 'Địa chỉ kiểm thử',
      coordinates: { lat: 11.24, lng: 106.2 },
      openTime: 'Cả ngày',
      distanceFromCenter: '1 km',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      highlights: ['Điểm nổi bật kiểm thử'],
      directionNote: 'Ghi chú chỉ đường kiểm thử.',
      mediaId: null,
      imageAlt: 'Điểm Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.mapPlace.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.mapPlace.createMany({
      data: [
        {
          id: ids.first,
          name: 'Điểm Thứ Nhất',
          category: MapPlaceCategory.HANH_CHINH,
          address: 'Địa chỉ A',
          lat: 11.2418,
          lng: 106.2024,
          openTime: 'Cả ngày',
          distanceFromCenter: '0 km',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          highlights: ['Nổi bật A'],
          directionNote: 'Ghi chú A',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Điểm Thứ Hai',
          category: MapPlaceCategory.DU_LICH,
          address: 'Địa chỉ B',
          lat: 11.3156,
          lng: 106.1972,
          openTime: 'Cả ngày',
          distanceFromCenter: '8 km',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          highlights: ['Nổi bật B'],
          directionNote: 'Ghi chú B',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Điểm Đang Ẩn',
          category: MapPlaceCategory.AM_THUC,
          address: 'Địa chỉ C',
          lat: 11.2294,
          lng: 106.2119,
          openTime: 'Cả ngày',
          distanceFromCenter: '2 km',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          highlights: ['Nổi bật C'],
          directionNote: 'Ghi chú C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.mapPlace.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('public list excludes hidden records, sorts by sortOrder and filters category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/map-places')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/map-places')
      .query({ category: 'Du lịch' })
      .expect(200);
    const filteredItems = (filtered.body as { data: Array<{ id: string }> })
      .data;
    expect(
      filteredItems.filter((item) => item.id.startsWith(prefix)),
    ).toHaveLength(1);
  });

  it('public detail hides existence of inactive and missing records', async () => {
    for (const id of [ids.hidden, `${prefix}-missing`]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/map-places/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('MAP_PLACE_NOT_FOUND');
    }
  });

  it('public detail returns coordinates with both lat/lng axes', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/map-places/${ids.first}`)
      .expect(200);
    expect(response.body.data.coordinates).toEqual({
      lat: 11.2418,
      lng: 106.2024,
    });
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/map-places')
      .expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Điểm Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('MAP_PLACE_SLUG_EXISTS');
  });

  it('rejects out-of-range or missing coordinate axes on create and update', async () => {
    const admin = await login('coords-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-bad-lat`,
          coordinates: { lat: 95, lng: 106.2 },
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-bad-lng`,
          coordinates: { lat: 11.24, lng: 200 },
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-missing-lng`, coordinates: { lat: 11.24 } }))
      .expect(400);

    const admin2 = admin;
    await request(app.getHttpServer())
      .put(`/api/v1/admin/map-places/${ids.first}`)
      .set('Authorization', `Bearer ${admin2.token}`)
      .send(body({ version: 1, coordinates: { lat: -95, lng: 106.2 } }))
      .expect(400);
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.mapPlace.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/map-places/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Điểm Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/map-places/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('MAP_PLACE_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe('Điểm Đã Cập Nhật');

    const otherAfter = await prisma.mapPlace.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/map-places/reorder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [
          { id: ids.first, sortOrder: 0 },
          { id: ids.second, sortOrder: 1 },
        ],
      })
      .expect(200);
    expect(
      (
        await prisma.mapPlace.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/map-places/reorder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [
          { id: ids.first, sortOrder: 9 },
          { id: `${prefix}-missing`, sortOrder: 0 },
        ],
      })
      .expect(404);
    expect(
      (
        await prisma.mapPlace.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/map-places/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/map-places/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/map-places/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.mapPlace.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/map-places')
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
      .post('/api/v1/admin/map-places')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_MAP_PLACE_MEDIA');
  });
});
