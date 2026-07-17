import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CraftVillageCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Craft villages (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `craft-${marker}`;
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
      name: 'Làng Nghề Kiểm Thử',
      category: 'Thủ công truyền thống',
      address: 'Ấp Kiểm Thử, xã Truông Mít',
      workingTime: '08:00 - 17:00',
      mainProducts: 'Sản phẩm kiểm thử',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      highlights: ['Điểm nổi bật kiểm thử'],
      visitorNote: 'Ghi chú tham quan kiểm thử.',
      mediaId: null,
      imageAlt: 'Làng Nghề Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.craftVillage.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.craftVillage.createMany({
      data: [
        {
          id: ids.first,
          name: 'Làng Nghề Thứ Nhất',
          category: CraftVillageCategory.THU_CONG_TRUYEN_THONG,
          address: 'Địa chỉ A',
          workingTime: '08:00 - 17:00',
          mainProducts: 'Sản phẩm A',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          highlights: ['Nổi bật A'],
          visitorNote: 'Ghi chú A',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Làng Nghề Thứ Hai',
          category: CraftVillageCategory.CHE_BIEN_NONG_SAN,
          address: 'Địa chỉ B',
          workingTime: 'Theo mùa',
          mainProducts: 'Sản phẩm B',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          highlights: ['Nổi bật B'],
          visitorNote: 'Ghi chú B',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Làng Nghề Đang Ẩn',
          category: CraftVillageCategory.DICH_VU_TRAI_NGHIEM,
          address: 'Địa chỉ C',
          workingTime: 'Cuối tuần',
          mainProducts: 'Sản phẩm C',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          highlights: ['Nổi bật C'],
          visitorNote: 'Ghi chú C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.craftVillage.deleteMany({
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
      .get('/api/v1/craft-villages')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/craft-villages')
      .query({ category: 'Chế biến nông sản' })
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
        .get(`/api/v1/craft-villages/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('CRAFT_VILLAGE_NOT_FOUND');
    }
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/craft-villages')
      .expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/craft-villages')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable Vietnamese slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/craft-villages')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Làng Nghề Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/craft-villages')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('CRAFT_VILLAGE_SLUG_EXISTS');
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.craftVillage.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/craft-villages/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Làng Nghề Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/craft-villages/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('CRAFT_VILLAGE_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe(
      'Làng Nghề Đã Cập Nhật',
    );

    const otherAfter = await prisma.craftVillage.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/craft-villages/reorder')
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
        await prisma.craftVillage.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/craft-villages/reorder')
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
        await prisma.craftVillage.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/craft-villages/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/craft-villages/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/craft-villages/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.craftVillage.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/craft-villages')
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
      .post('/api/v1/admin/craft-villages')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_CRAFT_VILLAGE_MEDIA');
  });
});
