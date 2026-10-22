import { INestApplication } from '@nestjs/common';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  UserRole,
} from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  userId: string;
  token: string;
}

interface SocketClient {
  socket: Socket;
  events: Array<{ event: string; payload: unknown }>;
}

interface NotificationPayload {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    readAt: string | null;
  };
  unreadCount: number;
}

describe('Notifications: bell + socket (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let socketUrl: string;
  const marker = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const applicationIds: string[] = [];
  const clients: SocketClient[] = [];

  const postPayload = {
    category: 'PRODUCT',
    title: `Bưởi da xanh thông báo ${marker}`,
    summary: 'Bưởi chín cây',
    description: 'Mô tả',
    priceType: 'NEGOTIABLE',
    address: 'Xã Truông Mít, Tây Ninh',
    contactName: 'Nguyễn Văn A',
    contactPhone: '0901234567',
  };

  async function login(
    label: string,
    role: UserRole = UserRole.USER,
  ): Promise<AuthedUser> {
    const zaloId = `zalo-notify-${label}-${randomUUID()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.update({
      where: { zaloId },
      data: { role },
    });
    userIds.push(user.id);
    return { userId: user.id, token: res.body.data.accessToken as string };
  }

  const auth = (user: AuthedUser) => ({
    Authorization: `Bearer ${user.token}`,
  });

  async function connect(token?: string): Promise<SocketClient> {
    const socket = io(`${socketUrl}/notifications`, {
      autoConnect: false,
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const client: SocketClient = { socket, events: [] };
    socket.onAny((event: string, payload: unknown) => {
      client.events.push({ event, payload });
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
      socket.connect();
    });
    return client;
  }

  async function waitForEvent<T>(
    client: SocketClient,
    event: string,
    matches: (payload: T) => boolean = () => true,
  ): Promise<T> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const found = client.events.find(
        (entry) => entry.event === event && matches(entry.payload as T),
      );
      if (found) return found.payload as T;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for socket event ${event}`);
  }

  const ofType = (type: string) => (payload: NotificationPayload) =>
    payload.notification.type === type;

  async function notificationTypes(user: AuthedUser): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .query({ limit: 100 })
      .set(auth(user))
      .expect(200);
    return (res.body.data as Array<{ type: string }>).map((item) => item.type);
  }

  async function createPublishedPost(
    owner: AuthedUser,
    admin: AuthedUser,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set(auth(owner))
      .send(postPayload)
      .expect(201);
    const postId = created.body.data.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${postId}/submit`)
      .set(auth(owner))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
      .set(auth(admin))
      .expect(200);
    return postId;
  }

  async function createApplication(suffix: string, submittedById: string) {
    const application = await prisma.businessApplication.create({
      data: {
        applicantType: BusinessApplicantType.ORGANIZATION,
        businessName: `Cơ sở ${marker} ${suffix}`,
        businessCategory: 'Du lịch',
        contactName: 'Nguyễn Văn A',
        contactPhone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
        contactEmail: `${marker}-${suffix}@example.com`,
        address: 'Tây Ninh',
        legalName: `Công ty ${suffix}`,
        taxCode: `${Date.now()}`,
        representativeName: 'Nguyễn Văn A',
        representativeTitle: 'Giám đốc',
        status: BusinessApplicationStatus.PENDING,
        submittedById,
      },
    });
    applicationIds.push(application.id);
    return application;
  }

  beforeAll(async () => {
    app = await createTestApp();
    // Sockets need a real listening port (supertest alone never opens one).
    await app.listen(0);
    const server = app.getHttpServer() as unknown as HttpServer;
    const address = server.address() as AddressInfo;
    socketUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const client of clients) client.socket.close();
    if (!app || !prisma) return;
    await prisma.tradeReview.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tradePost.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.businessApplication.deleteMany({
      where: { id: { in: applicationIds } },
    });
    // Notifications are removed with their users (onDelete: Cascade).
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('refuses sockets without a valid access token', async () => {
    await expect(connect()).rejects.toThrow('UNAUTHORIZED');
    await expect(connect('not-a-jwt')).rejects.toThrow('UNAUTHORIZED');
  });

  it('pushes the unread count on connect and the approval of a business application in realtime', async () => {
    const applicant = await login('applicant');
    const admin = await login('applicant-admin', UserRole.ADMIN);
    const client = await connect(applicant.token);
    expect(
      await waitForEvent<{ unreadCount: number }>(
        client,
        'notification.unread_count',
      ),
    ).toEqual({ unreadCount: 0 });

    const application = await createApplication('approve', applicant.userId);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set(auth(admin))
      .send({})
      .expect(201);

    const pushed = await waitForEvent<NotificationPayload>(
      client,
      'notification.new',
      ofType('BUSINESS_APPLICATION_APPROVED'),
    );
    expect(pushed.unreadCount).toBe(1);
    expect(pushed.notification.data).toEqual({ applicationId: application.id });

    const count = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(auth(applicant))
      .expect(200);
    expect(count.body.data).toEqual({ unreadCount: 1 });
  });

  it('tells the Zalo submitter why an application was rejected', async () => {
    const applicant = await login('rejected-applicant');
    const admin = await login('reject-admin', UserRole.ADMIN);
    const application = await createApplication('reject', applicant.userId);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set(auth(admin))
      .send({ reason: 'Thiếu giấy phép kinh doanh bản rõ nét' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(auth(applicant))
      .expect(200);
    expect(res.body.data[0]).toMatchObject({
      type: 'BUSINESS_APPLICATION_REJECTED',
      data: {
        applicationId: application.id,
        reason: 'Thiếu giấy phép kinh doanh bản rõ nét',
      },
    });
  });

  it('notifies the owner on approval and broadcasts a new post to other users only on first publication', async () => {
    const owner = await login('post-owner', UserRole.BUSINESS);
    const admin = await login('post-admin', UserRole.ADMIN);
    const resident = await login('resident');
    const residentSocket = await connect(resident.token);

    const postId = await createPublishedPost(owner, admin);
    const broadcast = await waitForEvent<NotificationPayload>(
      residentSocket,
      'notification.new',
      ofType('TRADE_POST_NEW'),
    );
    const post = await prisma.tradePost.findUniqueOrThrow({
      where: { id: postId },
      select: { slug: true },
    });
    expect(broadcast.notification.data).toEqual({
      tradePostId: postId,
      slug: post.slug,
      tradePostSlug: post.slug,
      tradePostTarget: 'PUBLIC_DETAIL',
      tradePostAvailable: true,
      tradePostStatus: 'PUBLISHED',
    });
    expect(broadcast.notification.data).not.toHaveProperty('ownerId');
    expect(broadcast.notification.data).not.toHaveProperty('contactPhone');
    const publicDetail = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${post.slug}`)
      .expect(200);
    expect(publicDetail.body.data.id).toBe(postId);
    expect(await notificationTypes(owner)).toEqual(['TRADE_POST_APPROVED']);
    expect(await notificationTypes(admin)).toEqual(['TRADE_POST_SUBMITTED']);

    // Editing a published post sends it back to moderation; re-approval is not news.
    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${postId}`)
      .set(auth(owner))
      .send({ title: `${postPayload.title} (cập nhật)` })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
      .set(auth(admin))
      .expect(200);
    expect(
      (await notificationTypes(resident)).filter(
        (type) => type === 'TRADE_POST_NEW',
      ),
    ).toHaveLength(1);
    expect(await notificationTypes(owner)).toEqual([
      'TRADE_POST_APPROVED',
      'TRADE_POST_APPROVED',
    ]);
    expect(await notificationTypes(admin)).toEqual([
      'TRADE_POST_SUBMITTED',
      'TRADE_POST_SUBMITTED',
    ]);
  });

  it('notifies the owner of every admin action on the post', async () => {
    const owner = await login('moderated-owner', UserRole.BUSINESS);
    const admin = await login('moderating-admin', UserRole.ADMIN);

    const rejected = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set(auth(owner))
      .send(postPayload)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${rejected.body.data.id}/submit`)
      .set(auth(owner))
      .expect(200);
    const submittedList = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .query({ limit: 100 })
      .set(auth(admin))
      .expect(200);
    const submitted = (
      submittedList.body.data as Array<{
        type: string;
        data: Record<string, unknown>;
      }>
    ).find((item) => item.type === 'TRADE_POST_SUBMITTED');
    expect(submitted?.data).toMatchObject({
      tradePostId: rejected.body.data.id,
      slug: rejected.body.data.slug,
      tradePostSlug: rejected.body.data.slug,
      tradePostTarget: 'ADMIN_MANAGE',
      tradePostAvailable: true,
      tradePostStatus: 'PENDING',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${rejected.body.data.id}/reject`)
      .set(auth(admin))
      .send({ reason: 'Ảnh chưa rõ sản phẩm' })
      .expect(200);

    const postId = await createPublishedPost(owner, admin);
    for (const action of ['feature', 'feature']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/${action}`)
        .set(auth(admin))
        .send({ featured: true })
        .expect(200);
    }
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/hide`)
      .set(auth(admin))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/unhide`)
      .set(auth(admin))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/trade-posts/${postId}`)
      .set(auth(admin))
      .expect(204);

    const types = await notificationTypes(owner);
    expect([...types].reverse()).toEqual([
      'TRADE_POST_REJECTED',
      'TRADE_POST_APPROVED',
      'TRADE_POST_FEATURED',
      'TRADE_POST_HIDDEN',
      'TRADE_POST_UNHIDDEN',
      'TRADE_POST_DELETED',
    ]);
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .query({ limit: 100 })
      .set(auth(owner))
      .expect(200);
    const rejection = (
      list.body.data as Array<{ type: string; data: Record<string, unknown> }>
    ).find((item) => item.type === 'TRADE_POST_REJECTED');
    expect(rejection?.data.reason).toBe('Ảnh chưa rõ sản phẩm');
    expect(rejection?.data).toMatchObject({
      tradePostId: rejected.body.data.id,
      tradePostSlug: rejected.body.data.slug,
      slug: rejected.body.data.slug,
      tradePostTarget: 'OWNER_MANAGE',
      tradePostAvailable: true,
      tradePostStatus: 'REJECTED',
    });

    const deleted = (
      list.body.data as Array<{ type: string; data: Record<string, unknown> }>
    ).find((item) => item.type === 'TRADE_POST_DELETED');
    expect(deleted?.data).toMatchObject({
      tradePostId: postId,
      tradePostTarget: 'OWNER_MANAGE',
      tradePostAvailable: false,
      tradePostUnavailableReason: 'DELETED',
    });
    const deletedDetail = await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${String(deleted?.data.tradePostSlug)}`)
      .expect(404);
    expect(deletedDetail.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('resolves legacy notification slugs by tradePostId and backfills stored payloads', async () => {
    const owner = await login('legacy-slug-owner', UserRole.BUSINESS);
    const admin = await login('legacy-slug-admin', UserRole.ADMIN);
    const postId = await createPublishedPost(owner, admin);
    const current = await prisma.tradePost.findUniqueOrThrow({
      where: { id: postId },
      select: { slug: true },
    });
    const newSlug = `${current.slug}-current`;
    await prisma.tradePost.update({
      where: { id: postId },
      data: { slug: newSlug },
    });
    const legacy = await prisma.notification.create({
      data: {
        userId: owner.userId,
        type: 'TRADE_POST_APPROVED',
        title: 'Payload cũ',
        body: 'Payload dùng slug cũ',
        data: { tradePostId: postId, slug: 'slug-khong-con-dung' },
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/${legacy.id}`)
      .set(auth(owner))
      .expect(200);
    expect(response.body.data.data).toEqual({
      tradePostId: postId,
      slug: newSlug,
      tradePostSlug: newSlug,
      tradePostTarget: 'OWNER_MANAGE',
      tradePostAvailable: true,
      tradePostStatus: 'PUBLISHED',
    });
    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: legacy.id },
    });
    expect(stored.data).toEqual(response.body.data.data);

    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${newSlug}`)
      .expect(200);
  });

  it('marks a notification unavailable without inventing a slug when its post is missing', async () => {
    const user = await login('missing-post-notification');
    const missingId = randomUUID();
    const notification = await prisma.notification.create({
      data: {
        userId: user.userId,
        type: 'TRADE_POST_NEW',
        title: 'Tin cũ',
        body: 'Tin không còn tồn tại',
        data: { tradePostId: missingId, slug: 'slug-cu-khong-hop-le' },
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/notifications/${notification.id}`)
      .expect(401);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/${notification.id}`)
      .set(auth(user))
      .expect(200);
    expect(response.body.data.data).toEqual({
      tradePostId: missingId,
      tradePostTarget: 'PUBLIC_DETAIL',
      tradePostAvailable: false,
      tradePostUnavailableReason: 'NOT_FOUND',
    });
  });

  it('follows a review through creation, reply, moderation and deletion', async () => {
    const owner = await login('review-owner', UserRole.BUSINESS);
    const admin = await login('review-admin', UserRole.ADMIN);
    const customer = await login('review-customer');
    const postId = await createPublishedPost(owner, admin);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/trade-posts/${postId}/reviews`)
      .set(auth(customer))
      .send({ rating: 5, content: 'Bưởi ngọt, giao nhanh' })
      .expect(201);
    const reviewId = created.body.data.id as string;
    // Reviews are public at once, so the owner hears about it right away.
    expect(await notificationTypes(owner)).toEqual([
      'TRADE_REVIEW_RECEIVED',
      'TRADE_POST_APPROVED',
    ]);
    expect(await notificationTypes(admin)).toEqual([
      'TRADE_REVIEW_SUBMITTED',
      'TRADE_POST_SUBMITTED',
    ]);

    await request(app.getHttpServer())
      .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
      .set(auth(owner))
      .send({ content: 'Cảm ơn bạn!' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/reviews/${reviewId}/status`)
      .set(auth(admin))
      .send({ status: 'HIDDEN' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/reviews/${reviewId}/status`)
      .set(auth(admin))
      .send({ status: 'PUBLISHED' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/reviews/${reviewId}`)
      .set(auth(admin))
      .expect(204);

    expect(await notificationTypes(owner)).toEqual([
      'TRADE_REVIEW_RECEIVED',
      'TRADE_POST_APPROVED',
    ]);
    const customerTypes = (await notificationTypes(customer)).filter(
      (type) => type !== 'TRADE_POST_NEW',
    );
    expect([...customerTypes].reverse()).toEqual([
      'TRADE_REVIEW_REPLIED',
      'TRADE_REVIEW_HIDDEN',
      'TRADE_REVIEW_APPROVED',
      'TRADE_REVIEW_DELETED',
    ]);
  });

  it('notifies the owner once when a customer saves the post', async () => {
    const owner = await login('saved-owner', UserRole.BUSINESS);
    const admin = await login('saved-admin', UserRole.ADMIN);
    const customer = await login('saver');
    const postId = await createPublishedPost(owner, admin);

    for (let i = 0; i < 2; i += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/save`)
        .set(auth(customer))
        .expect(201);
    }
    expect(
      (await notificationTypes(owner)).filter(
        (type) => type === 'TRADE_POST_SAVED',
      ),
    ).toHaveLength(1);
  });

  it('rings the bell for a new conversation and streams every chat message live', async () => {
    const owner = await login('chat-owner', UserRole.BUSINESS);
    const admin = await login('chat-admin', UserRole.ADMIN);
    const customer = await login('chat-customer');
    const postId = await createPublishedPost(owner, admin);
    const ownerSocket = await connect(owner.token);
    const customerSocket = await connect(customer.token);

    const opened = await request(app.getHttpServer())
      .post('/api/v1/trade-conversations')
      .set(auth(customer))
      .send({ tradePostId: postId, message: 'Còn hàng không?' })
      .expect(201);
    const conversationId = opened.body.data.id as string;

    const bell = await waitForEvent<NotificationPayload>(
      ownerSocket,
      'notification.new',
      ofType('TRADE_CONVERSATION_STARTED'),
    );
    expect(bell.notification.data).toMatchObject({
      conversationId,
      tradePostId: postId,
    });
    await waitForEvent<{ message: { content: string } }>(
      ownerSocket,
      'chat.message',
      (payload) => payload.message.content === 'Còn hàng không?',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/trade-conversations/${conversationId}/messages`)
      .set(auth(customer))
      .send({ content: 'Giá bao nhiêu?' })
      .expect(201);
    await waitForEvent<{ message: { content: string } }>(
      ownerSocket,
      'chat.message',
      (payload) => payload.message.content === 'Giá bao nhiêu?',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/trade-conversations/${conversationId}/messages`)
      .set(auth(owner))
      .send({ content: '120.000đ/kg' })
      .expect(201);
    const toCustomer = await waitForEvent<{
      conversationId: string;
      message: { senderId: string };
    }>(customerSocket, 'chat.message');
    expect(toCustomer).toMatchObject({
      conversationId,
      message: { senderId: owner.userId },
    });

    // Follow-up messages stay out of the bell (the inbox has its own unread count).
    expect(
      (await notificationTypes(owner)).filter(
        (type) => type === 'TRADE_CONVERSATION_STARTED',
      ),
    ).toHaveLength(1);
  });

  it('marks notifications read, syncs the badge across devices, and keeps others out', async () => {
    const user = await login('reader');
    const stranger = await login('reader-stranger');
    const [first] = await prisma.notification.createManyAndReturn({
      data: [1, 2].map((i) => ({
        userId: user.userId,
        type: 'TRADE_POST_NEW',
        title: `Tin mới ${i}`,
        body: 'Nội dung',
      })),
    });
    const phone = await connect(user.token);
    const tablet = await connect(user.token);

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set(auth(stranger))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set(auth(user))
      .expect(204);
    for (const device of [phone, tablet]) {
      await waitForEvent<{ unreadCount: number }>(
        device,
        'notification.unread_count',
        (payload) => payload.unreadCount === 1,
      );
    }
    const unread = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .query({ unreadOnly: true })
      .set(auth(user))
      .expect(200);
    expect(unread.body.meta.total).toBe(1);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set(auth(user))
      .expect(204);
    await waitForEvent<{ unreadCount: number }>(
      tablet,
      'notification.unread_count',
      (payload) => payload.unreadCount === 0,
    );
  });
});
