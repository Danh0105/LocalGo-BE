import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ContactCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Contacts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `contact-${marker}`;
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
      name: 'Liên Hệ Kiểm Thử',
      category: 'Hành chính',
      role: 'Vai trò kiểm thử',
      phone: '0900 111 222',
      email: 'kiemthu@example.vn',
      address: 'Địa chỉ kiểm thử',
      workingTime: 'Cả ngày',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      supportTopics: ['Chủ đề hỗ trợ kiểm thử'],
      note: 'Ghi chú kiểm thử.',
      mediaId: null,
      imageAlt: 'Liên Hệ Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.contact.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.contact.createMany({
      data: [
        {
          id: ids.first,
          name: 'Liên Hệ Thứ Nhất',
          category: ContactCategory.HANH_CHINH,
          role: 'Vai trò A',
          phone: '0900 111 111',
          email: 'a@example.vn',
          address: 'Địa chỉ A',
          workingTime: 'Giờ hành chính',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          supportTopics: ['Hỗ trợ A'],
          note: 'Ghi chú A',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Liên Hệ Thứ Hai',
          category: ContactCategory.DU_LICH,
          role: 'Vai trò B',
          phone: '0900 222 222',
          address: 'Địa chỉ B',
          workingTime: 'Cả ngày',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          supportTopics: ['Hỗ trợ B'],
          note: 'Ghi chú B',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Liên Hệ Đang Ẩn',
          category: ContactCategory.PHAN_ANH,
          role: 'Vai trò C',
          phone: '0900 333 333',
          address: 'Địa chỉ C',
          workingTime: 'Giờ hành chính',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          supportTopics: ['Hỗ trợ C'],
          note: 'Ghi chú C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({
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
      .get('/api/v1/contacts')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/contacts')
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
        .get(`/api/v1/contacts/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    }
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/contacts')
      .expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Liên Hệ Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('CONTACT_SLUG_EXISTS');
  });

  it('rejects an invalid phone format but accepts a valid one', async () => {
    const admin = await login('phone-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-bad-phone`, phone: 'gọi-cho-tôi-0900' }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-intl-phone`, phone: '+84900111222' }))
      .expect(201);
    expect(created.body.data.phone).toBe('+84900111222');
  });

  it('rejects an invalid email but accepts an empty one', async () => {
    const admin = await login('email-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-bad-email`, email: 'not-an-email' }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-no-email`, email: '' }))
      .expect(201);
    expect(created.body.data.email).toBeNull();
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.contact.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/contacts/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Liên Hệ Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/contacts/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('CONTACT_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe(
      'Liên Hệ Đã Cập Nhật',
    );

    const otherAfter = await prisma.contact.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/contacts/reorder')
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
        await prisma.contact.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/contacts/reorder')
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
        await prisma.contact.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/contacts/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/contacts/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/contacts/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.contact.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/contacts')
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
      .post('/api/v1/admin/contacts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_CONTACT_MEDIA');
  });
});
