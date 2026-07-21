import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UserRole } from '../generated/prisma';
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
  async function promoteToBusiness(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.BUSINESS },
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
      where: { code: { startsWith: categoryCodePrefix } },
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

  describe('trade post categories', () => {
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

      const codes = response.body.data.map(
        (category: { code: string }) => category.code,
      );
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

      const code = `${categoryCodePrefix}_CRUD`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          code: code.toLowerCase(),
          name: 'Danh mục CRUD',
          description: 'Danh mục test',
          sortOrder: 90,
          requiresPromotionDetails: false,
        })
        .expect(201);
      expect(created.body.data.code).toBe(code);

      await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ code: 'bad-code', name: 'Bad code' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/admin/trade-post-categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ code, name: 'Duplicate' })
        .expect(409);

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
      expect(
        listRes.body.data.map((post: { id: string }) => post.id),
      ).toContain(createRes.body.data.id);

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

    it('moderating reviews to PUBLISHED recomputes averageRating/reviewCount exactly, including under concurrent moderation', async () => {
      const { postId } = await createPublishedPost();
      const admin = await loginAsNewUser('rating-admin');
      await promoteToAdmin(admin.userId);

      const ratings = [5, 4, 3, 5, 2];
      const reviewIds: string[] = [];
      for (const rating of ratings) {
        const reviewer = await loginAsNewUser(
          `rating-reviewer-${rating}-${reviewIds.length}`,
        );
        const createRes = await request(app.getHttpServer())
          .post(`/api/v1/trade-posts/${postId}/reviews`)
          .set('Authorization', `Bearer ${reviewer.accessToken}`)
          .send({ rating, content: `Danh gia ${rating} sao` })
          .expect(201);
        reviewIds.push(createRes.body.data.id);
      }

      // Moderate all reviews to PUBLISHED concurrently — this is exactly the
      // race the atomic recompute (row-locked UPDATE) must survive.
      await Promise.all(
        reviewIds.map((id) =>
          request(app.getHttpServer())
            .patch(`/api/v1/admin/reviews/${id}/status`)
            .set('Authorization', `Bearer ${admin.accessToken}`)
            .send({ status: 'PUBLISHED' })
            .expect(200),
        ),
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
  });
});
