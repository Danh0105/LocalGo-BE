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
