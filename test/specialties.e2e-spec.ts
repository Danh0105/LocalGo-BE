import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { SpecialtyCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Specialties (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `specialty-${marker}`;
  const userIds: string[] = [];

  const ids = {
    first: `${prefix}-first`,
    second: `${prefix}-second`,
    hidden: `${prefix}-hidden`,
    deleted: `${prefix}-deleted`,
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
      name: 'Đặc Sản Kiểm Thử',
      category: 'Món ăn',
      price: '10.000 - 20.000đ/phần',
      season: 'Quanh năm',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      buyPlaceDetails: [
        {
          id: 'cho-kiem-thu',
          name: 'Chợ kiểm thử',
          address: 'Địa chỉ kiểm thử',
          googleMapsUrl: 'https://maps.app.goo.gl/cho-kiem-thu',
          phone: '0900 123 456',
          email: 'cho@example.com',
        },
      ],
      mediaId: null,
      imageAlt: 'Đặc Sản Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.specialty.deleteMany({ where: { id: { contains: marker } } });
    await prisma.specialty.createMany({
      data: [
        {
          id: ids.first,
          name: 'Món Thứ Nhất',
          category: SpecialtyCategory.MON_AN,
          price: '10.000đ',
          season: 'Quanh năm',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          buyPlaces: ['Nơi bán A'],
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Trái Cây Thứ Hai',
          category: SpecialtyCategory.TRAI_CAY,
          price: '20.000đ',
          season: 'Tháng 6',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          buyPlaces: ['Nơi bán B'],
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Quà Đang Ẩn',
          category: SpecialtyCategory.QUA_MANG_VE,
          price: '30.000đ',
          season: 'Quanh năm',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          buyPlaces: ['Nơi bán C'],
          sortOrder: 0,
          isActive: false,
        },
        {
          id: ids.deleted,
          name: 'Món Đã Xóa',
          category: SpecialtyCategory.MON_AN,
          price: '40.000đ',
          season: 'Quanh năm',
          summary: 'Tóm tắt đã xóa',
          description: ['Mô tả đã xóa'],
          buyPlaces: ['Nơi bán đã xóa'],
          sortOrder: 3,
          isActive: false,
          deletedAt: new Date('2026-08-21T00:00:00.000Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.specialty.deleteMany({ where: { id: { contains: marker } } });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('public list excludes hidden records, sorts by sortOrder and filters category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/specialties')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);
    expect(own).not.toContainEqual(
      expect.objectContaining({ id: ids.deleted }),
    );

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/specialties')
      .query({ category: 'Trái cây' })
      .expect(200);
    const filteredItems = (filtered.body as { data: Array<{ id: string }> })
      .data;
    expect(
      filteredItems.filter((item) => item.id.startsWith(prefix)),
    ).toHaveLength(1);
  });

  it('admin list validates includeDeleted and applies filters and pagination to soft-deleted records', async () => {
    const admin = await login('list-deleted-admin', UserRole.ADMIN);
    const authorization = { Authorization: `Bearer ${admin.token}` };

    for (const query of [{}, { includeDeleted: 'false' }]) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/specialties')
        .set(authorization)
        .query(query)
        .expect(200);
      const items = (
        response.body as {
          data: Array<{ id: string; deletedAt: string | null }>;
        }
      ).data;
      const own = items.filter((item) => item.id.startsWith(prefix));
      expect(own).toHaveLength(3);
      expect(own.every((item) => item.deletedAt === null)).toBe(true);
    }

    const included = await request(app.getHttpServer())
      .get('/api/v1/admin/specialties')
      .set(authorization)
      .query({
        includeDeleted: 'true',
        search: 'Món Đã Xóa',
        category: 'Món ăn',
        page: 1,
        limit: 1,
      })
      .expect(200);
    expect(included.body.data).toHaveLength(1);
    expect(included.body.data[0]).toEqual(
      expect.objectContaining({
        id: ids.deleted,
        deletedAt: '2026-08-21T00:00:00.000Z',
      }),
    );
    expect(included.body.meta).toEqual(
      expect.objectContaining({ total: 1, totalPages: 1 }),
    );

    const invalid = await request(app.getHttpServer())
      .get('/api/v1/admin/specialties')
      .set(authorization)
      .query({ includeDeleted: 'invalid' })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'includeDeleted' }),
      ]),
    );
  });

  it('public detail hides existence of inactive and missing records', async () => {
    for (const id of [ids.hidden, `${prefix}-missing`]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/specialties/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('SPECIALTY_NOT_FOUND');
    }
  });

  it('parses legacy buyPlaces strings and returns the compatibility names', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/specialties/${ids.first}`)
      .expect(200);

    expect(response.body.data.buyPlaces).toEqual(['Nơi bán A']);
    expect(response.body.data.buyPlaceDetails).toEqual([
      {
        id: 'noi-ban-a',
        name: 'Nơi bán A',
        address: '',
        googleMapsUrl: '',
        phone: '',
        email: '',
      },
    ]);
  });

  it('creates and updates structured buy places with maps and contacts', async () => {
    const admin = await login('buy-places-admin', UserRole.ADMIN);
    const places = [
      {
        id: 'cho-a',
        name: 'Chợ A',
        address: 'Địa chỉ A',
        googleMapsUrl: 'https://maps.app.goo.gl/cho-a',
        phone: '+84 900 111 222',
        email: 'cho-a@example.com',
      },
      {
        id: 'cua-hang-b',
        name: 'Cửa hàng B',
        address: 'Địa chỉ B',
        googleMapsUrl: 'https://www.google.com/maps/place/cua-hang-b',
        phone: '',
        email: '',
      },
    ];
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({ id: `${prefix}-structured-places`, buyPlaceDetails: places }),
      )
      .expect(201);
    expect(created.body.data.buyPlaceDetails).toEqual(places);
    expect(created.body.data.buyPlaces).toEqual(['Chợ A', 'Cửa hàng B']);

    const reordered = [places[1], places[0]];
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/admin/specialties/${prefix}-structured-places`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ version: 1, buyPlaceDetails: reordered }))
      .expect(200);
    expect(updated.body.data.buyPlaceDetails).toEqual(reordered);
  });

  it('accepts legacy buyPlaces only for an inactive draft', async () => {
    const admin = await login('legacy-buy-places-admin', UserRole.ADMIN);
    const payload: Record<string, unknown> = body({
      id: `${prefix}-legacy-places`,
      isActive: false,
      buyPlaces: ['Chợ legacy'],
    });
    delete payload.buyPlaceDetails;

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(payload)
      .expect(201);
    expect(created.body.data.buyPlaceDetails).toEqual([
      {
        id: 'cho-legacy',
        name: 'Chợ legacy',
        address: '',
        googleMapsUrl: '',
        phone: '',
        email: '',
      },
    ]);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/specialties/${prefix}-legacy-places/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true, version: 1 })
      .expect(400);
  });

  it('rejects invalid maps, phone, email and duplicate place ids', async () => {
    const admin = await login('buy-place-validation-admin', UserRole.ADMIN);
    const authorization = { Authorization: `Bearer ${admin.token}` };
    const invalidPlaces = [
      {
        id: 'bad-map',
        name: 'Sai bản đồ',
        googleMapsUrl: 'javascript:alert(1)',
      },
      {
        id: 'bad-phone',
        name: 'Sai điện thoại',
        googleMapsUrl: 'https://maps.app.goo.gl/bad-phone',
        phone: '0900-abc',
      },
      {
        id: 'bad-email',
        name: 'Sai email',
        googleMapsUrl: 'https://maps.app.goo.gl/bad-email',
        email: 'khong-phai-email',
      },
    ];

    for (const [index, place] of invalidPlaces.entries()) {
      await request(app.getHttpServer())
        .post('/api/v1/admin/specialties')
        .set(authorization)
        .send(
          body({
            id: `${prefix}-invalid-place-${index}`,
            isActive: false,
            buyPlaceDetails: [place],
          }),
        )
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set(authorization)
      .send(
        body({
          id: `${prefix}-duplicate-place`,
          buyPlaceDetails: [
            {
              id: 'trung',
              name: 'Địa điểm A',
              googleMapsUrl: 'https://maps.app.goo.gl/a',
            },
            {
              id: 'trung',
              name: 'Địa điểm B',
              googleMapsUrl: 'https://maps.app.goo.gl/b',
            },
          ],
        }),
      )
      .expect(400);
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/specialties')
      .expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable Vietnamese slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Đặc Sản Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('SPECIALTY_SLUG_EXISTS');
  });

  it('adds a numeric suffix when an automatically generated slug is already occupied', async () => {
    const admin = await login('slug-suffix-admin', UserRole.ADMIN);
    const first = await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: ids.first }))
      .expect(201);

    expect(first.body.data.id).toBe(`${ids.first}-2`);
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.specialty.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/specialties/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Món Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/specialties/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('SPECIALTY_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe('Món Đã Cập Nhật');

    const otherAfter = await prisma.specialty.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/specialties/reorder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [
          { id: ids.first, sortOrder: 0 },
          { id: ids.second, sortOrder: 1 },
        ],
      })
      .expect(200);
    expect(
      (await prisma.specialty.findUniqueOrThrow({ where: { id: ids.first } }))
        .sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/specialties/reorder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [
          { id: ids.first, sortOrder: 9 },
          { id: `${prefix}-missing`, sortOrder: 0 },
        ],
      })
      .expect(404);
    expect(
      (await prisma.specialty.findUniqueOrThrow({ where: { id: ids.first } }))
        .sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete soft-deletes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/specialties/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/specialties/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/specialties/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const deleted = await prisma.specialty.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.isActive).toBe(false);
  });

  it('update, status, reorder and delete reject soft-deleted records without changing them', async () => {
    const admin = await login('deleted-actions-admin', UserRole.ADMIN);
    const authorization = { Authorization: `Bearer ${admin.token}` };
    const before = await prisma.specialty.findUniqueOrThrow({
      where: { id: ids.deleted },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/specialties/${ids.deleted}`)
      .set(authorization)
      .send(body({ version: before.version }))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/specialties/${ids.deleted}/status`)
      .set(authorization)
      .send({ isActive: true, version: before.version })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/specialties/reorder')
      .set(authorization)
      .send({ items: [{ id: ids.deleted, sortOrder: 0 }] })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/specialties/${ids.deleted}`)
      .set(authorization)
      .expect(404);

    const after = await prisma.specialty.findUniqueOrThrow({
      where: { id: ids.deleted },
    });
    expect(after).toEqual(before);
    await request(app.getHttpServer())
      .get(`/api/v1/specialties/${ids.deleted}`)
      .expect(404);
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/specialties')
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
      .post('/api/v1/admin/specialties')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_SPECIALTY_MEDIA');
  });
});
