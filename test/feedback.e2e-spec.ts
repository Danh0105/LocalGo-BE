import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  FeedbackChannelCategory,
  FeedbackTicketStatus,
  UserRole,
} from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Feedback (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const prefix = `feedback-${marker}`;
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

  function channelBody(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Kênh Kiểm Thử',
      category: 'Góp ý chung',
      responseTime: 'Trong giờ hành chính',
      requiredInfo: ['Họ tên', 'Nội dung'],
      summary: 'Tóm tắt kiểm thử tích hợp.',
      description: ['Đoạn mô tả kiểm thử.'],
      examples: ['Ví dụ kiểm thử'],
      note: 'Ghi chú kiểm thử.',
      mediaId: null,
      imageAlt: 'Kênh Kiểm Thử',
      isActive: true,
      ...overrides,
    };
  }

  function ticketBody(overrides: Record<string, unknown> = {}) {
    return {
      fullName: 'Nguyễn Văn Kiểm Thử',
      phone: '0900 123 456',
      content: 'Nội dung phản hồi kiểm thử có độ dài hợp lệ.',
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.feedbackTicket.deleteMany({
      where: { fullName: { contains: marker } },
    });
    await prisma.feedbackChannel.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.feedbackChannel.createMany({
      data: [
        {
          id: ids.first,
          title: 'Kênh Thứ Nhất',
          category: FeedbackChannelCategory.GOP_Y_CHUNG,
          responseTime: 'Trong giờ hành chính',
          requiredInfo: ['Họ tên'],
          summary: 'Tóm tắt A',
          description: ['Mô tả A'],
          examples: ['Ví dụ A'],
          note: 'Ghi chú A',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: ids.second,
          title: 'Kênh Thứ Hai',
          category: FeedbackChannelCategory.DU_LICH,
          responseTime: 'Tổng hợp định kỳ',
          requiredInfo: ['Điểm tham quan'],
          summary: 'Tóm tắt B',
          description: ['Mô tả B'],
          examples: ['Ví dụ B'],
          note: 'Ghi chú B',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: ids.hidden,
          title: 'Kênh Đang Ẩn',
          category: FeedbackChannelCategory.MINI_APP,
          responseTime: 'Theo phiên bản',
          requiredInfo: ['Mô tả lỗi'],
          summary: 'Tóm tắt C',
          description: ['Mô tả C'],
          examples: ['Ví dụ C'],
          note: 'Ghi chú C',
          sortOrder: 0,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.feedbackTicket.deleteMany({
      where: { fullName: { contains: marker } },
    });
    await prisma.feedbackChannel.deleteMany({
      where: { id: { contains: marker } },
    });
    await prisma.media.deleteMany({
      where: { storageKey: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('Kênh phản hồi (Phần A)', () => {
    it('public list excludes hidden records, sorts by sortOrder and filters category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feedback/channels')
        .expect(200);
      const publicItems = (response.body as { data: Array<{ id: string }> })
        .data;
      const own = publicItems.filter((item) => item.id.startsWith(prefix));
      expect(own.map((item) => item.id)).toEqual([ids.second, ids.first]);

      const filtered = await request(app.getHttpServer())
        .get('/api/v1/feedback/channels')
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
          .get(`/api/v1/feedback/channels/${id}`)
          .expect(404);
        expect(response.body.error.code).toBe('FEEDBACK_CHANNEL_NOT_FOUND');
      }
    });

    it('protects all admin endpoints by authentication and role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/channels')
        .expect(401);
      const user = await login('channel-forbidden');
      await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/channels')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
    });

    it('generates a stable slug and rejects a duplicate slug', async () => {
      const admin = await login('channel-create-admin', UserRole.ADMIN);
      const created = await request(app.getHttpServer())
        .post('/api/v1/admin/feedback/channels')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(channelBody({ title: `Kênh Mới ${marker}` }))
        .expect(201);
      expect(created.body.data.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(created.body.data.version).toBe(1);

      const duplicate = await request(app.getHttpServer())
        .post('/api/v1/admin/feedback/channels')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(channelBody({ id: ids.first }))
        .expect(409);
      expect(duplicate.body.error.code).toBe('FEEDBACK_CHANNEL_SLUG_EXISTS');
    });

    it('updates only the target and returns latest data on a stale version conflict', async () => {
      const firstAdmin = await login('channel-update-first', UserRole.ADMIN);
      const secondAdmin = await login('channel-update-second', UserRole.ADMIN);
      const otherBefore = await prisma.feedbackChannel.findUniqueOrThrow({
        where: { id: ids.second },
      });

      await request(app.getHttpServer())
        .put(`/api/v1/admin/feedback/channels/${ids.first}`)
        .set('Authorization', `Bearer ${firstAdmin.token}`)
        .send(channelBody({ version: 1, title: 'Kênh Đã Cập Nhật' }))
        .expect(200);

      const conflict = await request(app.getHttpServer())
        .put(`/api/v1/admin/feedback/channels/${ids.first}`)
        .set('Authorization', `Bearer ${secondAdmin.token}`)
        .send(channelBody({ version: 1, title: 'Không Được Ghi Đè' }))
        .expect(409);
      expect(conflict.body.error.code).toBe(
        'FEEDBACK_CHANNEL_VERSION_CONFLICT',
      );
      expect(conflict.body.error.details[0].latest.title).toBe(
        'Kênh Đã Cập Nhật',
      );

      const otherAfter = await prisma.feedbackChannel.findUniqueOrThrow({
        where: { id: ids.second },
      });
      expect(otherAfter.sortOrder).toBe(otherBefore.sortOrder);
      expect(otherAfter.version).toBe(otherBefore.version);
    });

    it('reorders atomically and rolls back when any id is invalid', async () => {
      const admin = await login('channel-reorder-admin', UserRole.ADMIN);
      await request(app.getHttpServer())
        .patch('/api/v1/admin/feedback/channels/reorder')
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
          await prisma.feedbackChannel.findUniqueOrThrow({
            where: { id: ids.first },
          })
        ).sortOrder,
      ).toBe(0);

      await request(app.getHttpServer())
        .patch('/api/v1/admin/feedback/channels/reorder')
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
          await prisma.feedbackChannel.findUniqueOrThrow({
            where: { id: ids.first },
          })
        ).sortOrder,
      ).toBe(0);
    });

    it('status changes public visibility', async () => {
      const admin = await login('channel-status-admin', UserRole.ADMIN);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/feedback/channels/${ids.first}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ isActive: false, version: 1 })
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/feedback/channels/${ids.first}`)
        .expect(404);
    });
  });

  describe('Ticket phản hồi (Phần B)', () => {
    it('submits a valid ticket and returns a unique ticket code', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(ticketBody({ fullName: `Người Kiểm Thử ${marker}` }))
        .expect(201);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.ticketCode).toMatch(/^PH-[A-Z0-9]{6}$/);
      expect(response.body.data.id).toBeUndefined();

      const stored = await prisma.feedbackTicket.findFirst({
        where: { ticketCode: response.body.data.ticketCode },
      });
      expect(stored).not.toBeNull();
      expect(stored?.status).toBe(FeedbackTicketStatus.NEW);
      expect(stored?.fullName).toBe(`Người Kiểm Thử ${marker}`);
    });

    it('rejects missing fullName/phone/content or an invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send({
          phone: '0900123456',
          content: 'Nội dung hợp lệ nhưng thiếu họ tên.',
        })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `Thiếu SĐT ${marker}`,
            phone: undefined,
          }),
        )
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(ticketBody({ fullName: `Thiếu ND ${marker}`, content: '' }))
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `SĐT Sai ${marker}`,
            phone: 'gọi-cho-tôi-0900',
          }),
        )
        .expect(400);
    });

    it('rejects a channelId that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `Kênh Không Tồn Tại ${marker}`,
            channelId: `${prefix}-missing-channel`,
          }),
        )
        .expect(400);
    });

    it('accepts an existing channelId reference', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `Có Kênh ${marker}`,
            channelId: ids.first,
          }),
        )
        .expect(201);
      const stored = await prisma.feedbackTicket.findFirst({
        where: { ticketCode: response.body.data.ticketCode },
      });
      expect(stored?.channelId).toBe(ids.first);
    });

    it('never exposes a public list or detail endpoint for tickets', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/feedback/tickets')
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/feedback/tickets/some-id')
        .expect(404);
    });

    it('protects admin ticket endpoints by authentication and role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/tickets')
        .expect(401);
      const user = await login('ticket-forbidden');
      await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/tickets')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
    });

    it('admin lists tickets filtered by status/channelId and searches by name/phone/code', async () => {
      const admin = await login('ticket-list-admin', UserRole.ADMIN);
      const submitted = await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `Tìm Kiếm ${marker}`,
            phone: '0911222333',
            channelId: ids.first,
          }),
        )
        .expect(201);
      const ticketCode = submitted.body.data.ticketCode as string;

      const byChannel = await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/tickets')
        .query({ channelId: ids.first })
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(
        (byChannel.body.data as Array<{ ticketCode: string }>).some(
          (t) => t.ticketCode === ticketCode,
        ),
      ).toBe(true);

      const byStatus = await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/tickets')
        .query({ status: 'new' })
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(
        (byStatus.body.data as Array<{ ticketCode: string }>).some(
          (t) => t.ticketCode === ticketCode,
        ),
      ).toBe(true);

      const bySearch = await request(app.getHttpServer())
        .get('/api/v1/admin/feedback/tickets')
        .query({ search: ticketCode })
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(
        (bySearch.body.data as Array<{ ticketCode: string }>).map(
          (t) => t.ticketCode,
        ),
      ).toEqual([ticketCode]);
    });

    it('transitions new -> in_progress -> resolved successfully and rejects an invalid transition', async () => {
      const admin = await login('ticket-transition-admin', UserRole.ADMIN);
      const submitted = await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(ticketBody({ fullName: `Chuyển Trạng Thái ${marker}` }))
        .expect(201);
      const ticket = await prisma.feedbackTicket.findFirstOrThrow({
        where: { ticketCode: submitted.body.data.ticketCode as string },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/feedback/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'in_progress' })
        .expect(200);

      const resolved = await request(app.getHttpServer())
        .patch(`/api/v1/admin/feedback/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'resolved', adminNote: 'Đã xử lý xong.' })
        .expect(200);
      expect(resolved.body.data.status).toBe('resolved');
      expect(resolved.body.data.resolvedAt).not.toBeNull();

      const invalid = await request(app.getHttpServer())
        .patch(`/api/v1/admin/feedback/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'new' })
        .expect(409);
      expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('admin can view ticket detail including personal data', async () => {
      const admin = await login('ticket-detail-admin', UserRole.ADMIN);
      const submitted = await request(app.getHttpServer())
        .post('/api/v1/feedback/tickets')
        .send(
          ticketBody({
            fullName: `Chi Tiết ${marker}`,
            phone: '0933444555',
          }),
        )
        .expect(201);
      const ticket = await prisma.feedbackTicket.findFirstOrThrow({
        where: { ticketCode: submitted.body.data.ticketCode as string },
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/admin/feedback/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(detail.body.data.fullName).toBe(`Chi Tiết ${marker}`);
      expect(detail.body.data.phone).toBe('0933444555');
    });
  });
});
