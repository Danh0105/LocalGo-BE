import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { OcopCategory, OcopRating, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('OCOP (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `ocop-${marker}`;
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
      name: 'Sản Phẩm Kiểm Thử',
      category: 'Thực phẩm',
      rating: 4,
      producer: 'Cơ sở kiểm thử',
      address: 'Ấp Kiểm Thử, xã Truông Mít',
      priceRange: '10.000đ - 20.000đ',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      highlights: ['Điểm nổi bật kiểm thử'],
      contactNote: 'Ghi chú liên hệ kiểm thử.',
      contactPhone: '0900 000 001',
      mediaId: null,
      imageAlt: 'Sản Phẩm Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.ocopProduct.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.ocopProduct.createMany({
      data: [
        {
          id: ids.first,
          name: 'Sản Phẩm Thứ Nhất',
          category: OcopCategory.THUC_PHAM,
          rating: OcopRating.FOUR,
          producer: 'Cơ sở A',
          address: 'Địa chỉ A',
          priceRange: '10.000đ',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          highlights: ['Nổi bật A'],
          contactNote: 'Liên hệ A',
          contactPhone: '0900 111 111',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Sản Phẩm Thứ Hai',
          category: OcopCategory.DO_UONG,
          rating: OcopRating.THREE,
          producer: 'Cơ sở B',
          address: 'Địa chỉ B',
          priceRange: '20.000đ',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          highlights: ['Nổi bật B'],
          contactNote: 'Liên hệ B',
          contactPhone: '0900 222 222',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Sản Phẩm Đang Ẩn',
          category: OcopCategory.SAN_PHAM_CHE_BIEN,
          rating: OcopRating.FIVE,
          producer: 'Cơ sở C',
          address: 'Địa chỉ C',
          priceRange: '30.000đ',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          highlights: ['Nổi bật C'],
          contactNote: 'Liên hệ C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.ocopProduct.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('public list excludes hidden records, sorts by sortOrder and filters category/rating', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ocop')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filteredCategory = await request(app.getHttpServer())
      .get('/api/v1/ocop')
      .query({ category: 'Đồ uống' })
      .expect(200);
    expect(
      (filteredCategory.body as { data: Array<{ id: string }> }).data.filter(
        (item) => item.id.startsWith(prefix),
      ),
    ).toHaveLength(1);

    const filteredRating = await request(app.getHttpServer())
      .get('/api/v1/ocop')
      .query({ rating: 4 })
      .expect(200);
    expect(
      (filteredRating.body as { data: Array<{ id: string }> }).data.filter(
        (item) => item.id.startsWith(prefix),
      ),
    ).toHaveLength(1);
  });

  it('public detail hides existence of inactive and missing records', async () => {
    for (const id of [ids.hidden, `${prefix}-missing`]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ocop/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('OCOP_PRODUCT_NOT_FOUND');
    }
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/ocop').expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable Vietnamese slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Sản Phẩm Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('OCOP_PRODUCT_SLUG_EXISTS');
  });

  it('rejects a rating outside the {3,4,5} set on create and update', async () => {
    const admin = await login('rating-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-rating-low`, rating: 2 }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-rating-decimal`, rating: 4.5 }))
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/admin/ocop/${ids.first}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ version: 1, rating: 1 }))
      .expect(400);
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.ocopProduct.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/ocop/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Sản Phẩm Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/ocop/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('OCOP_PRODUCT_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe(
      'Sản Phẩm Đã Cập Nhật',
    );

    const otherAfter = await prisma.ocopProduct.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/ocop/reorder')
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
        await prisma.ocopProduct.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/ocop/reorder')
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
        await prisma.ocopProduct.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/ocop/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/ocop/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/ocop/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.ocopProduct.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
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
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_OCOP_PRODUCT_MEDIA');
  });

  it('public and admin detail return contactPhone', async () => {
    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/ocop/${ids.first}`)
      .expect(200);
    expect(
      (publicResponse.body as { data: { contactPhone: string } }).data
        .contactPhone,
    ).toBe('0900 111 111');

    const admin = await login('detail-admin', UserRole.ADMIN);
    const adminResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/ocop/${ids.first}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(
      (adminResponse.body as { data: { contactPhone: string } }).data
        .contactPhone,
    ).toBe('0900 111 111');
  });

  it('trims contactPhone on create/update and still increments version', async () => {
    const admin = await login('phone-update-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-phone-trim`,
          contactPhone: '  0911 222 333  ',
        }),
      )
      .expect(201);
    expect(created.body.data.contactPhone).toBe('0911 222 333');

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/admin/ocop/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ version: 1, contactPhone: '  +84 900 999 888  ' }))
      .expect(200);
    expect(updated.body.data.contactPhone).toBe('+84 900 999 888');
    expect(updated.body.data.version).toBe(2);
  });

  it('rejects a missing, too long or invalid contactPhone', async () => {
    const admin = await login('phone-validation-admin', UserRole.ADMIN);
    const withoutPhone: Record<string, unknown> = body({
      id: `${prefix}-phone-missing`,
    });
    delete withoutPhone.contactPhone;
    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(withoutPhone)
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-phone-blank`, contactPhone: '   ' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-phone-too-long`,
          contactPhone: '0'.repeat(31),
        }),
      )
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/ocop')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({ id: `${prefix}-phone-letters`, contactPhone: '0900-ABC-456' }),
      )
      .expect(400);
  });

  it('blocks activating a record that has no contactPhone yet', async () => {
    const admin = await login('phone-activate-admin', UserRole.ADMIN);
    const before = await prisma.ocopProduct.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    expect(before.contactPhone).toBeNull();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/ocop/${ids.hidden}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true, version: 1 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const after = await prisma.ocopProduct.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    expect(after.isActive).toBe(false);
    expect(after.version).toBe(1);
  });
});
