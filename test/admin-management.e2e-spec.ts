import { type INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessDocumentType,
  TradePostPriceType,
  TradePostStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Admin users, BUSINESS applications and trade owners (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const userIds: string[] = [];
  const applicationIds: string[] = [];
  const tradePostIds: string[] = [];
  const mediaIds: string[] = [];

  async function login(label: string, role = UserRole.USER) {
    const zaloId = `admin-e2e-${marker}-${label}`;
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

  async function getTradePostCategoryId(code: string): Promise<string> {
    const category = await prisma.tradePostCategory.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
        sortOrder: 0,
        isActive: true,
        requiresPromotionDetails: code === 'PROMOTION',
      },
    });
    return category.id;
  }

  async function createApplication(suffix: string, submittedById: string) {
    const application = await prisma.businessApplication.create({
      data: {
        applicantType: BusinessApplicantType.ORGANIZATION,
        businessName: `Business ${marker} ${suffix}`,
        businessCategory: 'Du lịch',
        contactName: 'Nguyễn Văn A',
        contactPhone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
        contactEmail: `${marker}-${suffix}@example.com`,
        address: 'Tây Ninh',
        legalName: `Công ty ${suffix}`,
        taxCode: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
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
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    await prisma.tradePost.deleteMany({ where: { id: { in: tradePostIds } } });
    await prisma.businessApplicationDocument.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
    await prisma.businessApplication.deleteMany({
      where: { id: { in: applicationIds } },
    });
    await prisma.media.deleteMany({ where: { id: { in: mediaIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('lists users with pagination, filter and case-insensitive search', async () => {
    const admin = await login('list-admin', UserRole.ADMIN);
    const target = await login('SearchTarget');
    await prisma.user.update({
      where: { id: target.id },
      data: { email: `${marker}-search@example.com` },
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .query({
        page: 1,
        limit: 10,
        role: 'USER',
        status: 'ACTIVE',
        search: `${marker}-SEARCH`,
      })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
  });

  it('prevents a moderator from blocking an admin', async () => {
    const moderator = await login('moderator', UserRole.MODERATOR);
    const admin = await login('protected-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${admin.id}/status`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .send({ status: 'BLOCKED' })
      .expect(403);
    expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSION');
  });

  it('blocks a user and revokes all active refresh sessions atomically', async () => {
    const admin = await login('block-admin', UserRole.ADMIN);
    const target = await login('block-target');
    const before = await prisma.authSession.count({
      where: { userId: target.id, revokedAt: null },
    });
    expect(before).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'BLOCKED' })
      .expect(200);
    const [user, activeSessions] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: target.id } }),
      prisma.authSession.count({
        where: { userId: target.id, revokedAt: null },
      }),
    ]);
    expect(user.status).toBe(UserStatus.BLOCKED);
    expect(activeSessions).toBe(0);
  });

  it('unblocks a user without restoring old sessions', async () => {
    const admin = await login('unblock-admin', UserRole.ADMIN);
    const target = await login('unblock-target');
    // Block first (via the endpoint, so the login session gets revoked),
    // then unblock — unblocking must not resurrect the revoked session.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'BLOCKED' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(response.body.data.status).toBe(UserStatus.ACTIVE);
    const activeSessions = await prisma.authSession.count({
      where: { userId: target.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);
  });

  it('prevents an admin from changing their own status', async () => {
    const admin = await login('self-status-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${admin.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'BLOCKED' })
      .expect(409);
    expect(response.body.error.code).toBe('CANNOT_UPDATE_SELF_STATUS');
  });

  it('rejects an invalid status value as a validation error', async () => {
    const admin = await login('invalid-status-admin', UserRole.ADMIN);
    const target = await login('invalid-status-target');
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'PENDING' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when updating status of a nonexistent user', async () => {
    const admin = await login('missing-user-admin', UserRole.ADMIN);
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${randomUUID()}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'BLOCKED' })
      .expect(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('validates required INDIVIDUAL identity fields and documents', async () => {
    const user = await login('invalid-individual');
    const response = await request(app.getHttpServer())
      .post('/api/v1/business-applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        applicantType: 'INDIVIDUAL',
        businessName: 'Cá nhân',
        businessCategory: 'Ẩm thực',
        contactName: 'Nguyễn A',
        contactPhone: '0901234567',
        contactEmail: 'individual@example.com',
        address: 'Tây Ninh',
        documents: [
          { mediaId: randomUUID(), type: 'OTHER', name: 'other.jpg' },
        ],
      })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_BUSINESS_APPLICATION');
  });

  it('validates ORGANIZATION tax code and business license', async () => {
    const user = await login('invalid-organization');
    const response = await request(app.getHttpServer())
      .post('/api/v1/business-applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        applicantType: 'ORGANIZATION',
        businessName: 'Công ty',
        businessCategory: 'Du lịch',
        contactName: 'Nguyễn A',
        contactPhone: '0912345678',
        contactEmail: 'organization@example.com',
        address: 'Tây Ninh',
        legalName: 'Công ty ABC',
        representativeName: 'Nguyễn A',
        representativeTitle: 'Giám đốc',
        documents: [
          { mediaId: randomUUID(), type: 'OTHER', name: 'other.pdf' },
        ],
      })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_BUSINESS_APPLICATION');
  });

  it('does not allow a user to edit another users rejected application', async () => {
    const owner = await login('application-owner');
    const stranger = await login('application-stranger');
    const application = await createApplication('ownership', owner.id);
    await prisma.businessApplication.update({
      where: { id: application.id },
      data: { status: BusinessApplicationStatus.REJECTED },
    });
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/business-applications/${application.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({
        applicantType: 'ORGANIZATION',
        businessName: 'Công ty',
        businessCategory: 'Du lịch',
        contactName: 'Nguyễn A',
        contactPhone: '0912345678',
        contactEmail: 'owner@example.com',
        address: 'Tây Ninh',
        legalName: 'Công ty ABC',
        taxCode: '3901234567',
        representativeName: 'Nguyễn A',
        representativeTitle: 'Giám đốc',
        documents: [
          {
            mediaId: randomUUID(),
            type: 'BUSINESS_LICENSE',
            name: 'license.pdf',
          },
        ],
      })
      .expect(404);
    expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('approves an application, promotes the submitting Zalo user and links createdUserId', async () => {
    const admin = await login('approve-admin', UserRole.ADMIN);
    const owner = await login('approve-owner');
    const application = await createApplication('approve', owner.id);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(201);
    const promoted = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(promoted).toMatchObject({
      role: UserRole.BUSINESS,
      email: application.contactEmail.toLowerCase(),
      phone: application.contactPhone,
    });
    expect(promoted.passwordHash).toBeNull();
    expect(response.body.data.createdUserId).toBe(owner.id);
  });

  it('allows only one of two concurrent approve requests to succeed', async () => {
    const admin = await login('concurrent-admin', UserRole.ADMIN);
    const owner = await login('concurrent-owner');
    const application = await createApplication('concurrent', owner.id);
    const calls = [1, 2].map(() =>
      request(app.getHttpServer())
        .post(`/api/v1/admin/business-applications/${application.id}/approve`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({}),
    );
    const responses = await Promise.all(calls);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
    const promoted = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(promoted.role).toBe(UserRole.BUSINESS);
    const reviewed = await prisma.businessApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(reviewed.createdUserId).toBe(owner.id);
  });

  it('requires a valid rejection reason', async () => {
    const admin = await login('reject-admin', UserRole.ADMIN);
    const owner = await login('reject-owner');
    const application = await createApplication('reject', owner.id);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'short' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Vui lòng bổ sung giấy phép kinh doanh hợp lệ.' })
      .expect(201);
    expect(response.body.data.status).toBe(BusinessApplicationStatus.REJECTED);
  });

  it('lists business applications with pagination and combined status/applicantType/search filters', async () => {
    const admin = await login('biz-list-admin', UserRole.ADMIN);
    const ownerA = await login('biz-list-owner-a');
    const ownerB = await login('biz-list-owner-b');
    const target = await createApplication('list-target', ownerA.id);
    await prisma.businessApplication.update({
      where: { id: target.id },
      data: { applicantType: BusinessApplicantType.INDIVIDUAL },
    });
    await createApplication('list-other', ownerB.id);
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/business-applications')
      .query({
        page: 1,
        limit: 10,
        status: 'PENDING',
        applicantType: 'INDIVIDUAL',
        search: 'list-target',
      })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(target.id);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
  });

  it('rolls back the whole transaction when the email is already taken', async () => {
    const admin = await login('email-conflict-admin', UserRole.ADMIN);
    const owner = await login('email-conflict-owner');
    const existing = await login('email-conflict-existing');
    const takenEmail = `${marker}-taken@example.com`;
    await prisma.user.update({
      where: { id: existing.id },
      data: { email: takenEmail },
    });
    const application = await createApplication('email-conflict', owner.id);
    await prisma.businessApplication.update({
      where: { id: application.id },
      data: { contactEmail: takenEmail },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    const stillPending = await prisma.businessApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(stillPending.status).toBe(BusinessApplicationStatus.PENDING);
    expect(stillPending.createdUserId).toBeNull();
    const usersWithApplicationPhone = await prisma.user.count({
      where: { phone: application.contactPhone },
    });
    expect(usersWithApplicationPhone).toBe(0);
  });

  it('rolls back the whole transaction when the phone is already taken', async () => {
    const admin = await login('phone-conflict-admin', UserRole.ADMIN);
    const owner = await login('phone-conflict-owner');
    const existing = await login('phone-conflict-existing');
    const application = await createApplication('phone-conflict', owner.id);
    await prisma.user.update({
      where: { id: existing.id },
      data: { phone: application.contactPhone },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(409);
    expect(response.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    const stillPending = await prisma.businessApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(stillPending.status).toBe(BusinessApplicationStatus.PENDING);
    const usersWithEmail = await prisma.user.count({
      where: { email: application.contactEmail },
    });
    expect(usersWithEmail).toBe(0);
  });

  it('rejects duplicate approve/reject attempts on an already-approved application', async () => {
    const admin = await login('double-review-admin', UserRole.ADMIN);
    const owner = await login('double-review-owner');
    const application = await createApplication('double-review', owner.id);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(201);
    const promoted = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(promoted.role).toBe(UserRole.BUSINESS);

    const secondApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(409);
    expect(secondApprove.body.error.code).toBe('APPLICATION_ALREADY_REVIEWED');

    const rejectAfterApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Lý do từ chối đủ dài để hợp lệ.' })
      .expect(409);
    expect(rejectAfterApprove.body.error.code).toBe(
      'APPLICATION_ALREADY_REVIEWED',
    );
  });

  it('rejects duplicate reject/approve attempts on an already-rejected application', async () => {
    const admin = await login('double-reject-admin', UserRole.ADMIN);
    const owner = await login('double-reject-owner');
    const application = await createApplication('double-reject', owner.id);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Lý do từ chối đủ dài để hợp lệ.' })
      .expect(201);

    const secondReject = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Một lý do khác cũng đủ dài để hợp lệ.' })
      .expect(409);
    expect(secondReject.body.error.code).toBe('APPLICATION_ALREADY_REVIEWED');

    const approveAfterReject = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(409);
    expect(approveAfterReject.body.error.code).toBe(
      'APPLICATION_ALREADY_REVIEWED',
    );
  });

  it('rejects a rejection reason longer than 500 characters', async () => {
    const admin = await login('reason-too-long-admin', UserRole.ADMIN);
    const owner = await login('reason-too-long-owner');
    const application = await createApplication('reason-too-long', owner.id);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/business-applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'a'.repeat(501) })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exposes signed, non-guessable document URLs and rejects expired or tampered signatures', async () => {
    const admin = await login('doc-security-admin', UserRole.ADMIN);
    const owner = await login('doc-security-owner');
    const application = await createApplication('doc-security', owner.id);
    const mediaId = randomUUID();
    const storageKey = `${marker}-${mediaId}.webp`;
    await prisma.media.create({
      data: {
        id: mediaId,
        ownerId: owner.id,
        storageKey,
        originalUrl: `https://example.invalid/${storageKey}`,
        mimeType: 'image/webp',
        size: 10,
        checksum: mediaId.replaceAll('-', ''),
      },
    });
    mediaIds.push(mediaId);
    const document = await prisma.businessApplicationDocument.create({
      data: {
        applicationId: application.id,
        mediaId,
        type: BusinessDocumentType.BUSINESS_LICENSE,
        name: 'license.pdf',
      },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/business-applications')
      .query({ search: 'doc-security' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const found = (
      list.body.data as Array<{ id: string; documents: unknown[] }>
    ).find((item) => item.id === application.id);
    expect(found?.documents).toHaveLength(1);
    const doc = found?.documents[0] as {
      id: string;
      name: string;
      type: string;
      url: string;
      mimeType: string;
    };
    expect(doc).toMatchObject({
      id: document.id,
      name: 'license.pdf',
      type: 'BUSINESS_LICENSE',
      mimeType: 'image/webp',
    });
    expect(doc.url).toContain('/api/v1/business-application-documents/');
    expect(doc.url).not.toContain(storageKey);
    expect(doc.url).not.toContain('mediaId');

    const parsedUrl = new URL(doc.url);
    const expires = Number(parsedUrl.searchParams.get('expires'));
    expect(expires).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const secret = process.env.JWT_ACCESS_SECRET as string;
    const sign = (payload: string) =>
      createHmac('sha256', secret).update(payload).digest('base64url');

    const tamperedUrl = new URL(doc.url);
    tamperedUrl.searchParams.set('signature', 'tampered-signature');
    const tamperedResponse = await request(app.getHttpServer())
      .get(tamperedUrl.pathname + tamperedUrl.search)
      .expect(403);
    expect(tamperedResponse.body.error.code).toBe('FORBIDDEN');

    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const expiredSignature = sign(`${document.id}.${expiredAt}`);
    const expiredResponse = await request(app.getHttpServer())
      .get(`/api/v1/business-application-documents/${document.id}`)
      .query({ expires: expiredAt, signature: expiredSignature })
      .expect(403);
    expect(expiredResponse.body.error.code).toBe('FORBIDDEN');
  });

  it('returns owner on admin trade-post list/detail without sensitive fields', async () => {
    const admin = await login('trade-admin', UserRole.ADMIN);
    const owner = await login('trade-owner');
    const categoryId = await getTradePostCategoryId('PRODUCT');
    const post = await prisma.tradePost.create({
      data: {
        slug: `owner-${marker}`,
        ownerId: owner.id,
        categoryId,
        title: `Owner response ${marker}`,
        summary: 'Summary',
        description: 'Description',
        priceType: TradePostPriceType.CONTACT,
        address: 'Tây Ninh',
        contactName: 'Liên hệ',
        contactPhone: '0901234567',
      },
    });
    tradePostIds.push(post.id);
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/trade-posts')
      .query({ search: marker })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(list.body.data[0].owner).toMatchObject({
      id: owner.id,
      displayName: 'trade-owner',
    });
    expect(list.body.data[0].owner).not.toHaveProperty('passwordHash');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/trade-posts/${post.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(detail.body.data.owner.id).toBe(owner.id);
  });

  it('allows an admin to hide, show again, and soft-delete an approved trade post', async () => {
    const admin = await login('hide-delete-admin', UserRole.ADMIN);
    const owner = await login('hide-delete-owner');
    const categoryId = await getTradePostCategoryId('PRODUCT');
    const post = await prisma.tradePost.create({
      data: {
        slug: `hide-delete-${marker}`,
        ownerId: owner.id,
        categoryId,
        title: `Hide delete ${marker}`,
        summary: 'Summary',
        description: 'Description',
        priceType: TradePostPriceType.CONTACT,
        address: 'Tây Ninh',
        contactName: 'Liên hệ',
        contactPhone: '0901234567',
        status: TradePostStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    tradePostIds.push(post.id);

    const hidden = await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${post.id}/hide`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(hidden.body.data.status).toBe(TradePostStatus.HIDDEN);
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${post.id}`)
      .expect(404);

    const shown = await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${post.id}/unhide`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(shown.body.data.status).toBe(TradePostStatus.PUBLISHED);
    await request(app.getHttpServer())
      .get(`/api/v1/trade-posts/${post.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/trade-posts/${post.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const deleted = await prisma.tradePost.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/trade-posts/${post.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });
});
