import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BusinessType,
  TradePostPriceType,
  TradePostPurpose,
  TradePostStatus,
  UserRole,
} from '../generated/prisma';
import { slugify } from '../src/common/utils/slugify.util';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  zaloId: string;
  userId: string;
  accessToken: string;
}

describe('Trade posts + reviews (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdZaloIds: string[] = [];
  const categoryCodePrefix = `E2E_${randomUUID().slice(0, 8).toUpperCase()}`;

  async function loginAsNewUser(label: string): Promise<AuthedUser> {
    const zaloId = `zalo-${label}-${randomUUID()}`;
    createdZaloIds.push(zaloId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { zaloId } });
    return {
      zaloId,
      userId: user.id,
      accessToken: res.body.data.accessToken as string,
    };
  }

  async function promoteToAdmin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    });
  }

  // Creating a trade post now requires role BUSINESS (an approved business
  // profile) — plain USER accounts can only browse/review, not post.
  async function promoteToBusiness(
    userId: string,
    businessType: BusinessType | null = null,
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.BUSINESS, businessType },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    // Deletion order matters: TradeReview.userId and TradePost.ownerId are
    // both onDelete:Restrict (deliberately — see docs/erd.md), so child rows
    // must be cleared before the owning test users can be removed.
    const users = await prisma.user.findMany({
      where: { zaloId: { in: createdZaloIds } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.tradeReview.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tradePost.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tradePostCategory.deleteMany({
      where: {
        OR: [
          { code: { startsWith: categoryCodePrefix } },
          { name: { contains: categoryCodePrefix } },
        ],
      },
    });
    await app.close();
  });

  const validPostPayload = {
    category: 'PRODUCT',
    title: 'Buoi da xanh Truong Mit e2e test',
    summary: 'Buoi da xanh dac san dia phuong',
    description: 'Mo ta chi tiet ve buoi da xanh',
    priceType: 'FIXED',
    price: 45000,
    address: 'Xa Truong Mit, Tay Ninh',
    googleMapsUrl: 'https://maps.app.goo.gl/localgo-e2e',
    contactName: 'Nguyen Van A',
    contactPhone: '0901234567',
  };

  describe('full submit -> approve -> publish -> public visibility path', () => {
    it('owner creates DRAFT, cannot be seen publicly, submits, admin approves, then is publicly visible', async () => {
      const owner = await loginAsNewUser('owner');
      await promoteToBusiness(owner.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;
      expect(createRes.body.data.status).toBe('DRAFT');
      expect(createRes.body.data.googleMapsUrl).toBe(
        validPostPayload.googleMapsUrl,
      );

      // Not visible publicly while DRAFT.
      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(404);

      // Owner submits for moderation.
      const submitRes = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(submitRes.body.data.status).toBe('PENDING');

      // A second, unrelated user cannot approve (RBAC).
      const stranger = await loginAsNewUser('stranger');
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(403);

      // Promote the stranger to ADMIN and approve.
      await promoteToAdmin(stranger.userId);
      const approveRes = await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(200);
      expect(approveRes.body.data.status).toBe('PUBLISHED');

      // Now publicly visible.
      const publicRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);
      expect(publicRes.body.data.status).toBe('PUBLISHED');
      expect(publicRes.body.data.googleMapsUrl).toBe(
        validPostPayload.googleMapsUrl,
      );
    });

    it('rejects an illegal transition (approving a DRAFT post)', async () => {
      const owner = await loginAsNewUser('owner2');
      await promoteToBusiness(owner.userId);
      const admin = await loginAsNewUser('admin2');
      await promoteToAdmin(admin.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);
    });
  });

  describe('Google Maps link and required fields', () => {
    it('validates the Maps URL and lets the owner clear it with null', async () => {
      const business = await loginAsNewUser('trade-google-maps');
      await promoteToBusiness(business.userId);

      await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ ...validPostPayload, googleMapsUrl: 'https://example.com/map' })
        .expect(400);

      const created = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({
          ...validPostPayload,
          googleMapsUrl: '  https://www.google.com/maps/place/LocalGo  ',
        })
        .expect(201);
      expect(created.body.data.googleMapsUrl).toBe(
        'https://www.google.com/maps/place/LocalGo',
      );

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${created.body.data.id}`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ googleMapsUrl: null })
        .expect(200);
      expect(updated.body.data.googleMapsUrl).toBeNull();
    });

    it('rejects missing or blank required text fields', async () => {
      const business = await loginAsNewUser('trade-required-fields');
      await promoteToBusiness(business.userId);

      const missing = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ ...validPostPayload, address: undefined })
        .expect(400);
      expect(missing.body.error.code).toBe('VALIDATION_ERROR');

      const blank = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ ...validPostPayload, title: '   ' })
        .expect(400);
      expect(blank.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('reject path', () => {
    it('moderator rejects a pending post with a reason', async () => {
      const owner = await loginAsNewUser('owner3');
      await promoteToBusiness(owner.userId);
      const admin = await loginAsNewUser('admin3');
      await promoteToAdmin(admin.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const rejectRes = await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/reject`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ reason: 'Thieu thong tin lien he' })
        .expect(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');
      expect(rejectRes.body.data.rejectedReason).toBe(
        'Thieu thong tin lien he',
      );
    });
  });

  describe('posting eligibility', () => {
    it('requires login before creating a trade post', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .send(validPostPayload)
        .expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('a plain USER cannot create a trade post and gets BUSINESS_PROFILE_REQUIRED', async () => {
      const plainUser = await loginAsNewUser('plain-user');

      const response = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${plainUser.accessToken}`)
        .send(validPostPayload)
        .expect(403);
      expect(response.body.error.code).toBe('BUSINESS_PROFILE_REQUIRED');

      const posts = await prisma.tradePost.count({
        where: { ownerId: plainUser.userId },
      });
      expect(posts).toBe(0);
    });

    it('a BUSINESS account can create a trade post', async () => {
      const business = await loginAsNewUser('eligible-business');
      await promoteToBusiness(business.userId);

      await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send(validPostPayload)
        .expect(201);
    });
  });

  describe('expiresAt', () => {
    it('rejects creating a post whose expiresAt is not in the future', async () => {
      const business = await loginAsNewUser('expires-past');
      await promoteToBusiness(business.userId);

      const response = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({
          ...validPostPayload,
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a future expiresAt and lets the owner clear it with null', async () => {
      const business = await loginAsNewUser('expires-clear');
      await promoteToBusiness(business.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({
          ...validPostPayload,
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        })
        .expect(201);
      expect(createRes.body.data.expiresAt).not.toBeNull();

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ expiresAt: null })
        .expect(200);
      expect(updateRes.body.data.expiresAt).toBeNull();
    });

    it('refuses to approve a pending post that has already expired', async () => {
      const owner = await loginAsNewUser('expires-owner');
      await promoteToBusiness(owner.userId);
      const admin = await loginAsNewUser('expires-admin');
      await promoteToAdmin(admin.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      // Simulates a post whose expiry passed while it waited for moderation.
      await prisma.tradePost.update({
        where: { id: postId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const approveRes = await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);
      expect(approveRes.body.error.code).toBe('TRADE_POST_EXPIRED');
    });
  });

  describe('non-profit posts', () => {
    const unpricedPayload: Partial<typeof validPostPayload> = {
      ...validPostPayload,
    };
    delete unpricedPayload.priceType;
    delete unpricedPayload.price;
    const eventPayload = {
      ...unpricedPayload,
      category: 'EVENT',
      title: 'Lễ hội Đền Bà e2e',
      purpose: 'NON_PROFIT',
    };

    async function publish(postId: string, owner: AuthedUser): Promise<void> {
      const admin = await loginAsNewUser('np-approver');
      await promoteToAdmin(admin.userId);
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
    }

    it('creates a non-profit post without any price and ignores a price sent anyway', async () => {
      const business = await loginAsNewUser('np-no-price');
      await promoteToBusiness(business.userId, BusinessType.GARDEN);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ ...eventPayload, priceType: 'FIXED', price: 1000 })
        .expect(201);
      expect(res.body.data).toMatchObject({
        purpose: 'NON_PROFIT',
        priceType: null,
        price: null,
        category: 'EVENT',
      });
    });

    it('still requires a price type for commercial posts', async () => {
      const business = await loginAsNewUser('np-commercial');
      await promoteToBusiness(business.userId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send(unpricedPayload)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('defaults a temple management board to non-profit and forbids commercial posts', async () => {
      const temple = await loginAsNewUser('np-temple');
      await promoteToBusiness(temple.userId, BusinessType.TEMPLE_MANAGEMENT);

      const defaulted = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${temple.accessToken}`)
        .send({ ...unpricedPayload, category: 'EVENT', priceType: 'CONTACT' })
        .expect(201);
      expect(defaulted.body.data).toMatchObject({
        purpose: 'NON_PROFIT',
        priceType: null,
      });

      const forbidden = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${temple.accessToken}`)
        .send({ ...validPostPayload, purpose: 'COMMERCIAL' })
        .expect(403);
      expect(forbidden.body.error.code).toBe('TRADE_POST_PURPOSE_NOT_ALLOWED');
    });

    it('rejects an event that already ended', async () => {
      const business = await loginAsNewUser('np-ended');
      await promoteToBusiness(business.userId);

      await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({
          ...eventPayload,
          eventStartAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          eventEndAt: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .expect(400);
    });

    it('stays public until the event ends when no expiresAt is set', async () => {
      const temple = await loginAsNewUser('np-event-visibility');
      await promoteToBusiness(temple.userId, BusinessType.TEMPLE_MANAGEMENT);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${temple.accessToken}`)
        .send({
          ...eventPayload,
          eventStartAt: new Date(Date.now() + 86_400_000).toISOString(),
          eventEndAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        })
        .expect(201);
      const postId: string = createRes.body.data.id;
      await publish(postId, temple);

      const listQuery = { purpose: 'NON_PROFIT', ownerId: temple.userId };
      const visible = await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query(listQuery)
        .expect(200);
      expect(visible.body.meta.total).toBe(1);
      expect(visible.body.data[0].eventEndAt).not.toBeNull();

      // The festival is over: the post leaves the public list and detail.
      await prisma.tradePost.update({
        where: { id: postId },
        data: { eventEndAt: new Date(Date.now() - 60_000) },
      });
      const afterEvent = await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query(listQuery)
        .expect(200);
      expect(afterEvent.body.meta.total).toBe(0);
      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(404);
    });

    it('clears the price when a draft is switched to non-profit, and event dates when switched back', async () => {
      const business = await loginAsNewUser('np-switch');
      await promoteToBusiness(business.userId);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;

      const toNonProfit = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({
          purpose: 'NON_PROFIT',
          eventEndAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(200);
      expect(toNonProfit.body.data).toMatchObject({
        purpose: 'NON_PROFIT',
        priceType: null,
        price: null,
      });
      expect(toNonProfit.body.data.eventEndAt).not.toBeNull();

      // Back to commercial without a price type is refused...
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ purpose: 'COMMERCIAL' })
        .expect(400);
      // ...and with one it drops the event dates.
      const toCommercial = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ purpose: 'COMMERCIAL', priceType: 'CONTACT' })
        .expect(200);
      expect(toCommercial.body.data).toMatchObject({
        purpose: 'COMMERCIAL',
        priceType: 'CONTACT',
        eventEndAt: null,
      });
    });
  });

  describe('trade posts embedded in content sections', () => {
    it('places restaurant, temple and garden posts only in their configured sections', async () => {
      const marker = `section-${randomUUID()}`;
      const [restaurant, garden, temple, accommodation, general] =
        await Promise.all(
          [
            'section-restaurant',
            'section-garden',
            'section-temple',
            'section-accommodation',
            'section-general',
          ].map((label) => loginAsNewUser(label)),
        );
      await Promise.all([
        promoteToBusiness(restaurant.userId, BusinessType.RESTAURANT),
        promoteToBusiness(garden.userId, BusinessType.GARDEN),
        promoteToBusiness(temple.userId, BusinessType.TEMPLE_MANAGEMENT),
        promoteToBusiness(accommodation.userId, BusinessType.ACCOMMODATION),
        promoteToBusiness(general.userId, BusinessType.GENERAL),
      ]);
      const category = await prisma.tradePostCategory.findUniqueOrThrow({
        where: { code: 'PRODUCT' },
      });
      const publishedAt = new Date();
      const post = (
        suffix: string,
        ownerId: string,
        purpose = TradePostPurpose.COMMERCIAL,
      ) => ({
        slug: `${marker}-${suffix}`,
        ownerId,
        categoryId: category.id,
        title: `${marker} ${suffix}`,
        summary: `Kiểm thử vị trí ${suffix}`,
        description: `Nội dung kiểm thử ${suffix}`,
        purpose,
        priceType:
          purpose === TradePostPurpose.NON_PROFIT
            ? null
            : TradePostPriceType.CONTACT,
        address: 'Xã Truông Mít, Tây Ninh',
        contactName: 'Người kiểm thử',
        contactPhone: '0901234567',
        status: TradePostStatus.PUBLISHED,
        publishedAt,
      });
      const created = await prisma.tradePost.createManyAndReturn({
        data: [
          post('restaurant', restaurant.userId),
          post('garden', garden.userId),
          post('temple', temple.userId, TradePostPurpose.NON_PROFIT),
          // Invalid legacy data must not leak into the temple tourism section.
          post('temple-commercial-legacy', temple.userId),
          post('accommodation', accommodation.userId),
          post('general', general.userId),
        ],
      });
      const idBySuffix = new Map(
        created.map((item) => [item.slug.slice(marker.length + 1), item.id]),
      );
      const legacyDraft = await prisma.tradePost.create({
        data: {
          ...post('temple-commercial-draft', temple.userId),
          status: TradePostStatus.DRAFT,
          publishedAt: null,
        },
      });

      const idsFor = async (section: string): Promise<string[]> => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/trade-posts')
          .query({ section, search: marker, limit: 100 })
          .expect(200);
        return (response.body.data as Array<{ id: string }>).map(
          (item) => item.id,
        );
      };

      expect(await idsFor('cuisine')).toEqual([idBySuffix.get('restaurant')]);
      expect(await idsFor('temples')).toEqual([idBySuffix.get('temple')]);
      const gardenId = idBySuffix.get('garden');
      expect(await idsFor('specialties')).toEqual([gardenId]);
      expect(await idsFor('agriculture')).toEqual([gardenId]);

      const forbiddenSubmit = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${legacyDraft.id}/submit`)
        .set('Authorization', `Bearer ${temple.accessToken}`)
        .expect(403);
      expect(forbiddenSubmit.body.error.code).toBe(
        'TRADE_POST_PURPOSE_NOT_ALLOWED',
      );

      const invalid = await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query({ section: 'unknown-section' })
        .expect(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('trade post categories', () => {
    it('answers 304 when If-None-Match matches the category list ETag', async () => {
      const first = await request(app.getHttpServer())
        .get('/api/v1/trade-post-categories')
        .expect(200);
      const etag = first.headers.etag;
      expect(etag).toBeTruthy();

      await request(app.getHttpServer())
        .get('/api/v1/trade-post-categories')
        .set('If-None-Match', etag)
        .expect(304);
    });

    it('lists only active categories publicly without a token', async () => {
      await prisma.tradePostCategory.createMany({
        data: [
          {
            code: `${categoryCodePrefix}_PUBLIC_ACTIVE`,
            name: 'Public Active',
            sortOrder: 100,
            isActive: true,
          },
          {
            code: `${categoryCodePrefix}_PUBLIC_HIDDEN`,
            name: 'Public Hidden',
            sortOrder: 101,
            isActive: false,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/trade-post-categories')
        .expect(200);

      const categories = response.body.data as Array<{ code: string }>;
      const codes = categories.map((category) => category.code);
      expect(codes).toContain(`${categoryCodePrefix}_PUBLIC_ACTIVE`);
      expect(codes).not.toContain(`${categoryCodePrefix}_PUBLIC_HIDDEN`);
      expect(response.body.data[0]).toHaveProperty('requiresPromotionDetails');
    });

    it('allows ADMIN to create/update/reorder/hide categories with optimistic locking', async () => {
      const user = await loginAsNewUser('category-user');
      const admin = await loginAsNewUser('category-admin');
      await promoteToAdmin(admin.userId);

      await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          code: `${categoryCodePrefix}_DENIED`,
          name: 'Denied',
        })
        .expect(403);

      const name = `Danh mục ${categoryCodePrefix} CRUD`;
      const expectedSlug = slugify(name).slice(0, 50);
      const created = await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name,
          description: 'Danh mục test',
          sortOrder: 90,
          isActive: true,
          requiresPromotionDetails: false,
        })
        .expect(201);
      expect(created.body.data.code).toBe(expectedSlug);
      expect(created.body.data.slug).toBe(expectedSlug);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/admin/trade-post-categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(detail.body.data.slug).toBe(expectedSlug);

      const list = await request(app.getHttpServer())
        .get('/api/v1/admin/trade-post-categories')
        .query({ search: categoryCodePrefix })
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(
        (list.body.data as Array<{ id: string }>).map((item) => item.id),
      ).toContain(created.body.data.id);

      const duplicatedName = await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name })
        .expect(201);
      expect(duplicatedName.body.data.slug).toBe(`${expectedSlug}-2`);

      await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: '' })
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'name' }),
          );
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-post-categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          code: `${categoryCodePrefix}_NEW_CODE`,
          name: 'Should reject code',
          sortOrder: 91,
          requiresPromotionDetails: false,
          version: created.body.data.version,
        })
        .expect(400);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-post-categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Danh mục đã sửa',
          description: null,
          sortOrder: 91,
          requiresPromotionDetails: true,
          version: created.body.data.version,
        })
        .expect(200);
      expect(updated.body.data.version).toBe(created.body.data.version + 1);
      expect(updated.body.data.slug).toBe(expectedSlug);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-post-categories/${created.body.data.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Stale',
          sortOrder: 92,
          requiresPromotionDetails: false,
          version: created.body.data.version,
        })
        .expect(409);

      await request(app.getHttpServer())
        .patch('/api/v1/admin/trade-post-categories/reorder')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          items: [
            {
              id: updated.body.data.id,
              sortOrder: 88,
              version: updated.body.data.version,
            },
            {
              id: randomUUID(),
              sortOrder: 89,
            },
          ],
        })
        .expect(404);
      const afterFailedReorder =
        await prisma.tradePostCategory.findUniqueOrThrow({
          where: { id: updated.body.data.id },
        });
      expect(afterFailedReorder.sortOrder).toBe(91);

      const hidden = await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/trade-post-categories/${updated.body.data.id}/status`,
        )
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isActive: false, version: updated.body.data.version })
        .expect(200);
      expect(hidden.body.data.isActive).toBe(false);

      await request(app.getHttpServer())
        .delete(
          `/api/v1/admin/trade-post-categories/${duplicatedName.body.data.id}`,
        )
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(
          `/api/v1/admin/trade-post-categories/${duplicatedName.body.data.id}`,
        )
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(404);
    });

    it('creates and filters trade posts by category code from DB', async () => {
      const owner = await loginAsNewUser('category-post-owner');
      await promoteToBusiness(owner.userId);
      const code = `${categoryCodePrefix}_POST`;
      await prisma.tradePostCategory.create({
        data: {
          code,
          name: 'Danh mục đăng tin',
          sortOrder: 102,
          isActive: true,
        },
      });

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ...validPostPayload, category: code })
        .expect(201);
      expect(createRes.body.data.category).toBe(code);
      expect(createRes.body.data.categoryInfo.name).toBe('Danh mục đăng tin');

      const admin = await loginAsNewUser('category-post-admin');
      await promoteToAdmin(admin.userId);
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${createRes.body.data.id}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${createRes.body.data.id}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query({ category: code })
        .expect(200);
      const posts = listRes.body.data as Array<{ id: string }>;
      expect(posts.map((post) => post.id)).toContain(createRes.body.data.id);

      await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query({ category: `${categoryCodePrefix}_UNKNOWN` })
        .expect(400);
    });

    it('rejects inactive categories publicly and prevents deleting a category in use', async () => {
      const owner = await loginAsNewUser('inactive-category-owner');
      await promoteToBusiness(owner.userId);
      const admin = await loginAsNewUser('inactive-category-admin');
      await promoteToAdmin(admin.userId);
      const category = await prisma.tradePostCategory.create({
        data: {
          code: `${categoryCodePrefix}_IN_USE`,
          name: 'Category In Use',
          sortOrder: 103,
          isActive: true,
        },
      });
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ ...validPostPayload, category: category.code })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${createRes.body.data.id}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${createRes.body.data.id}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/trade-post-categories/${category.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-post-categories/${category.id}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isActive: false, version: category.version })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${createRes.body.data.id}`)
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/v1/trade-posts')
        .query({ category: category.code })
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/trade-posts/me')
        .query({ category: category.code })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
    });
  });

  describe('ownership enforcement', () => {
    it('a non-owner cannot edit or delete someone else’s post', async () => {
      const owner = await loginAsNewUser('owner4');
      await promoteToBusiness(owner.userId);
      const stranger = await loginAsNewUser('stranger4');

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .send({ title: 'Hacked title' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/trade-posts/${postId}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(403);
    });

    it('owner cannot self-publish or self-feature (those fields are rejected by the global whitelist validation, not silently accepted)', async () => {
      const owner = await loginAsNewUser('owner5');
      await promoteToBusiness(owner.userId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        // CreateTradePostDto has no `status`/`featured` fields — with
        // forbidNonWhitelisted:true these must be rejected outright, not
        // silently stripped or (worse) accepted.
        .send({ ...validPostPayload, status: 'PUBLISHED', featured: true })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('reviews + rating recomputation', () => {
    async function createPublishedPost(): Promise<{
      postId: string;
      owner: AuthedUser;
    }> {
      const owner = await loginAsNewUser('review-owner');
      await promoteToBusiness(owner.userId);
      const admin = await loginAsNewUser('review-admin');
      await promoteToAdmin(admin.userId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/trade-posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validPostPayload)
        .expect(201);
      const postId: string = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}/submit`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      return { postId, owner };
    }

    it('owner cannot review their own post', async () => {
      const { postId, owner } = await createPublishedPost();

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ rating: 5, content: 'Tot lam' })
        .expect(403);
    });

    it('a second review from the same user on the same post is rejected', async () => {
      const { postId } = await createPublishedPost();
      const reviewer = await loginAsNewUser('reviewer-dup');

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 4, content: 'Kha tot' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 5, content: 'Danh gia lai' })
        .expect(409);
    });

    it('rejects rating outside 1-5 and content over 500 chars', async () => {
      const { postId } = await createPublishedPost();
      const reviewer = await loginAsNewUser('reviewer-invalid');

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 6, content: 'x' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 5, content: 'x'.repeat(501) })
        .expect(400);
    });

    it('publishes a new review immediately and keeps it published after the reviewer edits it', async () => {
      const { postId } = await createPublishedPost();
      const reviewer = await loginAsNewUser('reviewer-instant');

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 2, content: 'Hien thi ngay' })
        .expect(201);
      const reviewId: string = createRes.body.data.id;
      expect(createRes.body.data.status).toBe('PUBLISHED');

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      expect(
        (publicList.body.data as Array<{ id: string }>).map(
          (review) => review.id,
        ),
      ).toEqual([reviewId]);
      const postRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);
      expect(postRes.body.data.reviewCount).toBe(1);
      expect(Number(postRes.body.data.averageRating)).toBe(2);

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 4, content: 'Da sua danh gia' })
        .expect(200);
      expect(updateRes.body.data.status).toBe('PUBLISHED');
      const afterEditRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);
      expect(afterEditRes.body.data.reviewCount).toBe(1);
      expect(Number(afterEditRes.body.data.averageRating)).toBe(4);
    });

    it('keeps a review hidden by an admin hidden when the reviewer edits it', async () => {
      const { postId } = await createPublishedPost();
      const admin = await loginAsNewUser('hidden-edit-admin');
      await promoteToAdmin(admin.userId);
      const reviewer = await loginAsNewUser('reviewer-hidden-edit');

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 1, content: 'Noi dung xau' })
        .expect(201);
      const reviewId: string = createRes.body.data.id;
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reviews/${reviewId}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ status: 'HIDDEN' })
        .expect(200);

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${reviewer.accessToken}`)
        .send({ rating: 5, content: 'Da sua' })
        .expect(200);
      expect(updateRes.body.data.status).toBe('HIDDEN');
      const postRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);
      expect(postRes.body.data.reviewCount).toBe(0);
    });

    it('creating reviews recomputes averageRating/reviewCount exactly, including under concurrent creation', async () => {
      const { postId } = await createPublishedPost();
      const admin = await loginAsNewUser('rating-admin');
      await promoteToAdmin(admin.userId);

      const ratings = [5, 4, 3, 5, 2];
      const reviewers: AuthedUser[] = [];
      for (const [index, rating] of ratings.entries()) {
        reviewers.push(
          await loginAsNewUser(`rating-reviewer-${rating}-${index}`),
        );
      }

      // Create all reviews concurrently — this is exactly the race the
      // atomic recompute (row-locked UPDATE) must survive.
      const reviewIds = await Promise.all(
        ratings.map(async (rating, index) => {
          const createRes = await request(app.getHttpServer())
            .post(`/api/v1/trade-posts/${postId}/reviews`)
            .set('Authorization', `Bearer ${reviewers[index].accessToken}`)
            .send({ rating, content: `Danh gia ${rating} sao` })
            .expect(201);
          return createRes.body.data.id as string;
        }),
      );

      const postRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);

      const expectedAverage =
        Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10;
      expect(postRes.body.data.reviewCount).toBe(ratings.length);
      expect(Number(postRes.body.data.averageRating)).toBeCloseTo(
        expectedAverage,
        1,
      );

      // Hiding one review must reduce the count and adjust the average.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reviews/${reviewIds[0]}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ status: 'HIDDEN' })
        .expect(200);

      const afterHideRes = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(200);
      expect(afterHideRes.body.data.reviewCount).toBe(ratings.length - 1);
    });

    describe('admin review management', () => {
      async function createReview(
        postId: string,
        label: string,
        rating: number,
        content: string,
      ): Promise<{ reviewId: string; reviewer: AuthedUser }> {
        const reviewer = await loginAsNewUser(label);
        const res = await request(app.getHttpServer())
          .post(`/api/v1/trade-posts/${postId}/reviews`)
          .set('Authorization', `Bearer ${reviewer.accessToken}`)
          .send({ rating, content })
          .expect(201);
        return { reviewId: res.body.data.id as string, reviewer };
      }

      it('lists reviews with post and reviewer info, filters by rating/search and counts by status', async () => {
        const { postId } = await createPublishedPost();
        const admin = await loginAsNewUser('mgmt-admin');
        await promoteToAdmin(admin.userId);
        const good = await createReview(
          postId,
          'mgmt-good',
          5,
          'Buoi rat ngon',
        );
        await createReview(postId, 'mgmt-bad', 2, 'Giao hang cham');

        const listRes = await request(app.getHttpServer())
          .get('/api/v1/admin/reviews')
          .query({ tradePostId: postId })
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(200);
        expect(listRes.body.meta.total).toBe(2);
        const goodRow = (
          listRes.body.data as Array<{
            id: string;
            tradePost: { id: string; title: string; deleted: boolean };
            user: { id: string };
          }>
        ).find((row) => row.id === good.reviewId);
        expect(goodRow?.tradePost).toMatchObject({
          id: postId,
          title: validPostPayload.title,
          deleted: false,
        });
        expect(goodRow?.user.id).toBe(good.reviewer.userId);

        const byRating = await request(app.getHttpServer())
          .get('/api/v1/admin/reviews')
          .query({ tradePostId: postId, rating: 2 })
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(200);
        expect(byRating.body.data).toHaveLength(1);
        expect(byRating.body.data[0].content).toBe('Giao hang cham');

        const bySearch = await request(app.getHttpServer())
          .get('/api/v1/admin/reviews')
          .query({ tradePostId: postId, search: 'RAT NGON' })
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(200);
        expect(bySearch.body.data).toHaveLength(1);
        expect(bySearch.body.data[0].id).toBe(good.reviewId);

        await request(app.getHttpServer())
          .patch(`/api/v1/admin/reviews/${good.reviewId}/status`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({ status: 'HIDDEN' })
          .expect(200);

        const statsRes = await request(app.getHttpServer())
          .get('/api/v1/admin/reviews/stats')
          .query({ tradePostId: postId })
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(200);
        expect(statsRes.body.data).toEqual({
          total: 2,
          byStatus: { PENDING: 0, PUBLISHED: 1, HIDDEN: 1 },
        });

        const detailRes = await request(app.getHttpServer())
          .get(`/api/v1/admin/reviews/${good.reviewId}`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(200);
        expect(detailRes.body.data.status).toBe('HIDDEN');
        expect(detailRes.body.data.user.id).toBe(good.reviewer.userId);
      });

      it('deletes a review, recomputes the post rating and writes an audit log', async () => {
        const { postId } = await createPublishedPost();
        const admin = await loginAsNewUser('mgmt-delete-admin');
        await promoteToAdmin(admin.userId);
        const { reviewId } = await createReview(
          postId,
          'mgmt-delete-reviewer',
          4,
          'Se bi xoa',
        );
        const beforeRes = await request(app.getHttpServer())
          .get(`/api/v1/trade-posts/${postId}`)
          .expect(200);
        expect(beforeRes.body.data.reviewCount).toBe(1);

        await request(app.getHttpServer())
          .delete(`/api/v1/admin/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(204);

        const afterRes = await request(app.getHttpServer())
          .get(`/api/v1/trade-posts/${postId}`)
          .expect(200);
        expect(afterRes.body.data.reviewCount).toBe(0);
        await request(app.getHttpServer())
          .get(`/api/v1/admin/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .expect(404);
        const auditCount = await prisma.auditLog.count({
          where: {
            action: 'TRADE_REVIEW_DELETE',
            resourceId: reviewId,
            actorId: admin.userId,
          },
        });
        expect(auditCount).toBe(1);
      });

      it('forbids non-moderators from the admin review endpoints', async () => {
        const plainUser = await loginAsNewUser('mgmt-plain');
        const auth = `Bearer ${plainUser.accessToken}`;

        await request(app.getHttpServer())
          .get('/api/v1/admin/reviews')
          .set('Authorization', auth)
          .expect(403);
        await request(app.getHttpServer())
          .get('/api/v1/admin/reviews/stats')
          .set('Authorization', auth)
          .expect(403);
        await request(app.getHttpServer())
          .delete(`/api/v1/admin/reviews/${randomUUID()}`)
          .set('Authorization', auth)
          .expect(403);
      });
    });
  });
});
