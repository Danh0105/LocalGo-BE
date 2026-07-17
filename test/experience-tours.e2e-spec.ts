import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ExperienceTourCategory, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Experience tours (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `tour-${marker}`;
  const userIds: string[] = [];

  const ids = {
    first: `${prefix}-first`,
    second: `${prefix}-second`,
    hidden: `${prefix}-hidden`,
  };

  const orderedItinerary = [
    'Bước một: đón khách',
    'Bước hai: tham quan',
    'Bước ba: dùng bữa',
    'Bước bốn: kết thúc',
  ];

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
      name: 'Tour Kiểm Thử',
      category: 'Nông nghiệp',
      duration: '1 ngày',
      startTime: '07:30 - 16:30',
      priceRange: '100.000đ/người',
      meetingPoint: 'Điểm hẹn kiểm thử',
      summary: 'Nội dung tóm tắt dùng cho kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      itinerary: [...orderedItinerary],
      included: ['Mục bao gồm kiểm thử'],
      note: 'Ghi chú kiểm thử.',
      contactPhone: '0900 000 001',
      mediaId: null,
      imageAlt: 'Tour Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.experienceTour.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.experienceTour.createMany({
      data: [
        {
          id: ids.first,
          name: 'Tour Thứ Nhất',
          category: ExperienceTourCategory.NONG_NGHIEP,
          duration: '1 ngày',
          startTime: '07:30 - 16:30',
          priceRange: '100.000đ/người',
          meetingPoint: 'Điểm hẹn A',
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          itinerary: orderedItinerary,
          included: ['Bao gồm A'],
          note: 'Ghi chú A',
          contactPhone: '0900 111 111',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          name: 'Tour Thứ Hai',
          category: ExperienceTourCategory.NUA_NGAY,
          duration: '3 giờ',
          startTime: '15:30',
          priceRange: '150.000đ/người',
          meetingPoint: 'Điểm hẹn B',
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          itinerary: ['Bước B1', 'Bước B2'],
          included: ['Bao gồm B'],
          note: 'Ghi chú B',
          contactPhone: '0900 222 222',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          name: 'Tour Đang Ẩn',
          category: ExperienceTourCategory.GIA_DINH,
          duration: 'Nửa ngày',
          startTime: '08:00',
          priceRange: '200.000đ/người',
          meetingPoint: 'Điểm hẹn C',
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          itinerary: ['Bước C1'],
          included: ['Bao gồm C'],
          note: 'Ghi chú C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.experienceTour.deleteMany({
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
      .get('/api/v1/experience-tours')
      .expect(200);
    const publicItems = (response.body as { data: Array<{ id: string }> }).data;
    const own = publicItems.filter((item) => item.id.startsWith(prefix));
    expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/experience-tours')
      .query({ category: 'Nửa ngày' })
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
        .get(`/api/v1/experience-tours/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('EXPERIENCE_TOUR_NOT_FOUND');
    }
  });

  it('public detail returns itinerary in the exact stored order', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/experience-tours/${ids.first}`)
      .expect(200);
    expect(
      (response.body as { data: { itinerary: string[] } }).data.itinerary,
    ).toEqual(orderedItinerary);
  });

  it('protects all admin endpoints by authentication and role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/experience-tours')
      .expect(401);
    const user = await login('forbidden');
    await request(app.getHttpServer())
      .get('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('generates a stable Vietnamese slug and rejects a duplicate slug', async () => {
    const admin = await login('create-admin', UserRole.ADMIN);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ name: `Tour Mới ${marker}` }))
      .expect(201);
    expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(created.body.data.version).toBe(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: ids.first }))
      .expect(409);
    expect(duplicate.body.error.code).toBe('EXPERIENCE_TOUR_SLUG_EXISTS');
  });

  it('rejects creating/activating a tour with an empty itinerary', async () => {
    const admin = await login('empty-itinerary-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-empty-itinerary`, itinerary: [] }))
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates only the target and returns latest data on a stale version conflict', async () => {
    const firstAdmin = await login('update-first', UserRole.ADMIN);
    const secondAdmin = await login('update-second', UserRole.ADMIN);
    const otherBefore = await prisma.experienceTour.findUniqueOrThrow({
      where: { id: ids.second },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/experience-tours/${ids.first}`)
      .set('Authorization', `Bearer ${firstAdmin.token}`)
      .send(body({ version: 1, name: 'Tour Đã Cập Nhật' }))
      .expect(200);

    const conflict = await request(app.getHttpServer())
      .put(`/api/v1/admin/experience-tours/${ids.first}`)
      .set('Authorization', `Bearer ${secondAdmin.token}`)
      .send(body({ version: 1, name: 'Không Được Ghi Đè' }))
      .expect(409);
    expect(conflict.body.error.code).toBe('EXPERIENCE_TOUR_VERSION_CONFLICT');
    expect(conflict.body.error.details[0].latest.name).toBe('Tour Đã Cập Nhật');

    const otherAfter = await prisma.experienceTour.findUniqueOrThrow({
      where: { id: ids.second },
    });
    expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
    expect(otherAfter.version).toBe(otherBefore.version);
  });

  it('reorders atomically and rolls back when any id is invalid', async () => {
    const admin = await login('reorder-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/experience-tours/reorder')
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
        await prisma.experienceTour.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/experience-tours/reorder')
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
        await prisma.experienceTour.findUniqueOrThrow({
          where: { id: ids.first },
        })
      ).sortOrder,
    ).toBe(0);
  });

  it('status changes public visibility and delete removes the record', async () => {
    const admin = await login('status-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/experience-tours/${ids.first}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false, version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/experience-tours/${ids.first}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/experience-tours/${ids.second}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    expect(
      await prisma.experienceTour.findUnique({ where: { id: ids.second } }),
    ).toBeNull();
  });

  it('rejects missing media and non-image media', async () => {
    const admin = await login('media-admin', UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
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
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-wrong-media`, mediaId }))
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_EXPERIENCE_TOUR_MEDIA');
  });

  it('public and admin detail return contactPhone', async () => {
    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/experience-tours/${ids.first}`)
      .expect(200);
    expect(
      (publicResponse.body as { data: { contactPhone: string } }).data
        .contactPhone,
    ).toBe('0900 111 111');

    const admin = await login('detail-admin', UserRole.ADMIN);
    const adminResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/experience-tours/${ids.first}`)
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
      .post('/api/v1/admin/experience-tours')
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
      .put(`/api/v1/admin/experience-tours/${ids.second}`)
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
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(withoutPhone)
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body({ id: `${prefix}-phone-blank`, contactPhone: '   ' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({
          id: `${prefix}-phone-too-long`,
          contactPhone: '0'.repeat(31),
        }),
      )
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/experience-tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        body({ id: `${prefix}-phone-letters`, contactPhone: '0900-ABC-456' }),
      )
      .expect(400);
  });

  it('blocks activating a record that has no contactPhone yet', async () => {
    const admin = await login('phone-activate-admin', UserRole.ADMIN);
    const before = await prisma.experienceTour.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    expect(before.contactPhone).toBeNull();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/experience-tours/${ids.hidden}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: true, version: 1 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const after = await prisma.experienceTour.findUniqueOrThrow({
      where: { id: ids.hidden },
    });
    expect(after.isActive).toBe(false);
    expect(after.version).toBe(1);
  });
});
