import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CuisineCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Cuisine (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `cuisine-${marker}`;
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
      name: 'Món Ăn Kiểm Thử',
      category: 'Món nước',
      priceRange: '20.000đ - 30.000đ',
      bestTime: 'Buổi sáng',
      suggestedPlaceDetails: [
        {
          id: 'quan-kiem-thu',
          name: 'Quán kiểm thử',
          address: 'Địa chỉ kiểm thử',
          googleMapsUrl: 'https://maps.app.goo.gl/example',
        },
      ],
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      highlights: ['Điểm nổi bật kiểm thử'],
      tip: 'Mẹo thưởng thức kiểm thử.',
      mediaId: null,
      imageAlt: 'Món Ăn Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.cuisineItem.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.cuisineItem.createMany({
      data: [
        {
          id: ids.first,
          name: 'Món Thứ Nhất',
          category: CuisineCategory.MON_NUOC,
          priceRange: '10.000đ',
          bestTime: 'Buổi sáng',
          suggestedPlaces: ['Nơi A'],
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          highlights: ['Nổi bật A'],
          tip: 'Mẹo A',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Món Thứ Hai',
          category: CuisineCategory.MON_NUONG,
          priceRange: '20.000đ',
          bestTime: 'Buổi trưa',
          suggestedPlaces: ['Nơi B'],
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          highlights: ['Nổi bật B'],
          tip: 'Mẹo B',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Món Đang Ẩn',
          category: CuisineCategory.MON_CHAY,
          priceRange: '30.000đ',
          bestTime: 'Quanh năm',
          suggestedPlaces: ['Nơi C'],
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          highlights: ['Nổi bật C'],
          tip: 'Mẹo C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.cuisineItem.deleteMany({
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
      .get('/api/v1/cuisine')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/cuisine')
      .query({ category: 'Món nướng' })
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
        .get(`/api/v1/cuisine/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('CUISINE_ITEM_NOT_FOUND');
    }
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/cuisine').expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable Vietnamese slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Món Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('CUISINE_ITEM_SLUG_EXISTS');
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.cuisineItem.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/cuisine/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Món Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/cuisine/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('CUISINE_ITEM_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe('Món Đã Cập Nhật');

    const otherAfter = await prisma.cuisineItem.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/cuisine/reorder')
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
        await prisma.cuisineItem.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/cuisine/reorder')
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
        await prisma.cuisineItem.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/cuisine/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/cuisine/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/cuisine/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.cuisineItem.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
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
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_CUISINE_ITEM_MEDIA');
  });

  it('parses legacy string suggestedPlaces into suggestedPlaceDetails and derives the same names', async () => {
    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/cuisine/${ids.first}`)
      .expect(200);
    const publicData = publicResponse.body.data;
    expect(publicData.suggestedPlaces).toEqual(['Nơi A']);
    expect(publicData.suggestedPlaceDetails).toEqual([
      { id: 'noi-a', name: 'Nơi A', address: '', googleMapsUrl: '' },
    ]);

    const admin = await login('legacy-detail-admin', UserRole.ADMIN);
    const adminResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/cuisine/${ids.first}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(adminResponse.body.data.suggestedPlaceDetails).toEqual([
      { id: 'noi-a', name: 'Nơi A', address: '', googleMapsUrl: '' },
    ]);
  });

  it('creates and updates via suggestedPlaceDetails, preserving order and full shape', async () => {
    const admin = await login('places-crud-admin', UserRole.ADMIN);
    const places = [
      {
        id: 'dia-diem-1',
        name: 'Địa điểm 1',
        address: 'Địa chỉ 1',
        googleMapsUrl: 'https://maps.app.goo.gl/aaa',
      },
      {
        id: 'dia-diem-2',
        name: 'Địa điểm 2',
        address: 'Địa chỉ 2',
        googleMapsUrl: 'https://www.google.com/maps/place/xyz',
      },
    ];
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-places`, suggestedPlaceDetails: places }))
      .expect(201);
    expect(created.body.data.suggestedPlaceDetails).toEqual(places);
    expect(created.body.data.suggestedPlaces).toEqual([
      'Địa điểm 1',
      'Địa điểm 2',
    ]);

    const reordered = [places[1], places[0]];
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/admin/cuisine/${ids.first}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ version: 1, suggestedPlaceDetails: reordered }))
      .expect(200);
    expect(updated.body.data.suggestedPlaceDetails).toEqual(reordered);
    expect(updated.body.data.version).toBe(2);
  });

  it('accepts the legacy suggestedPlaces string payload when suggestedPlaceDetails is omitted', async () => {
    const admin = await login('legacy-payload-admin', UserRole.ADMIN);
    const payload: Record<string, unknown> = body({
      id: `${prefix}-legacy-payload`,
      isActive: false,
    });
    delete payload.suggestedPlaceDetails;
    payload.suggestedPlaces = ['Quán legacy'];

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(payload)
      .expect(201);
    expect(created.body.data.suggestedPlaces).toEqual(['Quán legacy']);
    expect(created.body.data.suggestedPlaceDetails).toEqual([
      {
        id: 'quan-legacy',
        name: 'Quán legacy',
        address: '',
        googleMapsUrl: '',
      },
    ]);
  });

  it('prefers suggestedPlaceDetails when both legacy and new payload are sent', async () => {
    const admin = await login('priority-admin', UserRole.ADMIN);
    const payload: Record<string, unknown> = body({
      id: `${prefix}-priority`,
      suggestedPlaceDetails: [
        {
          id: 'moi',
          name: 'Địa điểm mới',
          address: 'Địa chỉ',
          googleMapsUrl: 'https://maps.app.goo.gl/moi',
        },
      ],
    });
    payload.suggestedPlaces = ['Địa điểm cũ bị bỏ qua'];

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(payload)
      .expect(201);
    expect(created.body.data.suggestedPlaces).toEqual(['Địa điểm mới']);
  });

  it('rejects invalid or unsafe googleMapsUrl values', async () => {
    const admin = await login('url-validation-admin', UserRole.ADMIN);
    const invalidUrls = [
      'http://www.google.com/maps',
      'javascript:alert(1)',
      'https://www.google.com.evil.example/maps',
      'https://user:pass@maps.google.com',
      'not a url',
      `https://maps.google.com/?q=${'a'.repeat(2100)}`,
      'https://goo.gl/other-path',
    ];
    for (const [index, googleMapsUrl] of invalidUrls.entries()) {
      await request(app.getHttpServer())
        .post('/api/v1/admin/cuisine')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(
          body({
            id: `${prefix}-bad-url-${index}`,
            isActive: false,
            suggestedPlaceDetails: [
              { id: 'p', name: 'P', address: 'A', googleMapsUrl },
            ],
          }),
        )
        .expect(400);
    }
  });

  it('rejects duplicate ids within suggestedPlaceDetails', async () => {
    const admin = await login('dup-id-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-dup-id`,
          isActive: false,
          suggestedPlaceDetails: [
            { id: 'trung', name: 'A', address: '', googleMapsUrl: '' },
            { id: 'trung', name: 'B', address: '', googleMapsUrl: '' },
          ],
        }),
      )
      .expect(400);
  });

  it('rejects more than 20 suggested places', async () => {
    const admin = await login('too-many-admin', UserRole.ADMIN);
    const places = Array.from({ length: 21 }, (_, i) => ({
      id: `p-${i}`,
      name: `Địa điểm ${i}`,
      address: '',
      googleMapsUrl: '',
    }));
    await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-too-many`,
          isActive: false,
          suggestedPlaceDetails: places,
        }),
      )
      .expect(400);
  });

  it('rejects unknown fields inside a suggested place object', async () => {
    const admin = await login('whitelist-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-extra-field`,
          isActive: false,
          suggestedPlaceDetails: [
            { id: 'p', name: 'P', address: '', googleMapsUrl: '', evil: 'x' },
          ],
        }),
      )
      .expect(400);
  });

  it('blocks activating a cuisine item whose suggested places are missing address/googleMapsUrl', async () => {
    const admin = await login('activate-guard-admin', UserRole.ADMIN);

    await request(app.getHttpServer())
      .post('/api/v1/admin/cuisine')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-activate-guard`,
          isActive: true,
          suggestedPlaceDetails: [
            { id: 'p', name: 'P', address: '', googleMapsUrl: '' },
          ],
        }),
      )
      .expect(400);

    const before = await prisma.cuisineItem.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/cuisine/${ids.hidden}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true, version: 1 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const after = await prisma.cuisineItem.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    expect(after.isActive).toBe(false);
    expect(after.version).toBe(before.version);
  });
});
