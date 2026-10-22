import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UserRole, UserStatus } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  userId: string;
  token: string;
}

interface ReviewCustomerReplyBody {
  id: string;
  author: { id: string; displayName: string; avatarUrl: string | null } | null;
}

interface ReviewWithCustomerRepliesBody {
  id: string;
  customerReplies: ReviewCustomerReplyBody[];
}

describe('Trade seller center: management, review replies, chat (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const postPayload = {
    category: 'PRODUCT',
    title: 'Sầu riêng Ri6 seller center e2e',
    summary: 'Sầu riêng chín cây',
    description: 'Mô tả chi tiết',
    priceType: 'NEGOTIABLE',
    address: 'Xã Truông Mít, Tây Ninh',
    contactName: 'Nguyễn Văn A',
    contactPhone: '0901234567',
  };

  async function login(
    label: string,
    role: UserRole = UserRole.USER,
  ): Promise<AuthedUser> {
    const zaloId = `zalo-seller-${label}-${randomUUID()}`;
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

  async function createPost(
    owner: AuthedUser,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trade-posts')
      .set(auth(owner))
      .send({ ...postPayload, ...overrides })
      .expect(201);
    return res.body.data.id as string;
  }

  async function publishPost(owner: AuthedUser, postId: string): Promise<void> {
    const admin = await login('publisher', UserRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/v1/trade-posts/${postId}/submit`)
      .set(auth(owner))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/trade-posts/${postId}/approve`)
      .set(auth(admin))
      .expect(200);
  }

  async function createPublishedPost(
    label: string,
  ): Promise<{ owner: AuthedUser; postId: string }> {
    const owner = await login(`${label}-owner`, UserRole.BUSINESS);
    const postId = await createPost(owner);
    await publishPost(owner, postId);
    return { owner, postId };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    // Reviews and conversations go with their posts (onDelete: Cascade);
    // reviews on other users' posts are cleared explicitly (userId is Restrict).
    await prisma.tradeReview.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tradePost.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('post management', () => {
    it('limits seller endpoints to ACTIVE BUSINESS accounts', async () => {
      const plain = await login('plain');
      const notBusiness = await request(app.getHttpServer())
        .get('/api/v1/trade-posts/me')
        .set(auth(plain))
        .expect(403);
      expect(notBusiness.body.error.code).toBe('BUSINESS_PROFILE_REQUIRED');

      const pending = await login('pending-business', UserRole.BUSINESS);
      await prisma.user.update({
        where: { id: pending.userId },
        data: { status: UserStatus.PENDING },
      });
      const notActive = await request(app.getHttpServer())
        .get('/api/v1/trade-posts/me')
        .set(auth(pending))
        .expect(403);
      expect(notActive.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('serves unpublished posts through /manage to the owner and staff only', async () => {
      const owner = await login('manage-owner', UserRole.BUSINESS);
      const other = await login('manage-other', UserRole.BUSINESS);
      const admin = await login('manage-admin', UserRole.ADMIN);
      const postId = await createPost(owner);

      const own = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/manage`)
        .set(auth(owner))
        .expect(200);
      expect(own.body.data.status).toBe('DRAFT');

      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/manage`)
        .set(auth(other))
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set(auth(other))
        .send({ title: 'Chiếm quyền' })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/manage`)
        .set(auth(admin))
        .expect(200);
    });

    it('clears optional values with null on PATCH', async () => {
      const owner = await login('null-owner', UserRole.BUSINESS);
      const postId = await createPost(owner, {
        price: 120000,
        priceLabel: '120.000đ/kg',
        contactZalo: '0901234567',
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });

      const cleared = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${postId}`)
        .set(auth(owner))
        .send({
          price: null,
          priceLabel: null,
          contactZalo: null,
          expiresAt: null,
        })
        .expect(200);
      expect(cleared.body.data).toMatchObject({
        price: null,
        priceLabel: null,
        contactZalo: null,
        expiresAt: null,
      });

      const promotionId = await createPost(owner, {
        category: 'PROMOTION',
        promotionPercent: 20,
        promotionStartAt: new Date(Date.now() + 86_400_000).toISOString(),
        promotionEndAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      });
      const demoted = await request(app.getHttpServer())
        .patch(`/api/v1/trade-posts/${promotionId}`)
        .set(auth(owner))
        .send({
          category: 'PRODUCT',
          promotionPercent: null,
          promotionStartAt: null,
          promotionEndAt: null,
        })
        .expect(200);
      expect(demoted.body.data).toMatchObject({
        category: 'PRODUCT',
        promotionPercent: null,
        promotionStartAt: null,
        promotionEndAt: null,
      });
    });

    it('sorts my posts by creation time in the requested order', async () => {
      const owner = await login('sort-owner', UserRole.BUSINESS);
      const first = await createPost(owner, { title: 'Tin thứ nhất' });
      const second = await createPost(owner, { title: 'Tin thứ hai' });

      const asc = await request(app.getHttpServer())
        .get('/api/v1/trade-posts/me')
        .query({ sortBy: 'newest', sortOrder: 'asc', status: 'DRAFT' })
        .set(auth(owner))
        .expect(200);
      expect(
        (asc.body.data as Array<{ id: string }>).map((post) => post.id),
      ).toEqual([first, second]);

      const desc = await request(app.getHttpServer())
        .get('/api/v1/trade-posts/me')
        .query({ sortOrder: 'desc' })
        .set(auth(owner))
        .expect(200);
      expect(
        (desc.body.data as Array<{ id: string }>).map((post) => post.id),
      ).toEqual([second, first]);
    });
  });

  describe('review replies', () => {
    async function publishedReview(postId: string): Promise<{
      reviewId: string;
      customer: AuthedUser;
    }> {
      const customer = await login('reviewer');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set(auth(customer))
        .send({ rating: 5, content: 'Sầu riêng ngon, cơm vàng' })
        .expect(201);
      return { reviewId: res.body.data.id as string, customer };
    }

    it('lets the post owner reply publicly, without exposing private data, and remove the reply', async () => {
      const { owner, postId } = await createPublishedPost('reply');
      const { reviewId, customer } = await publishedReview(postId);

      const inbox = await request(app.getHttpServer())
        .get('/api/v1/trade-management/reviews')
        .set(auth(owner))
        .expect(200);
      expect(inbox.body.meta.total).toBe(1);
      expect(inbox.body.data[0]).toMatchObject({
        id: reviewId,
        reviewer: { id: customer.userId },
        tradePost: { id: postId },
      });

      const replied = await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: '   Cảm ơn bạn đã tin tưởng!   ' })
        .expect(200);
      expect(replied.body.data.replyContent).toBe('Cảm ơn bạn đã tin tưởng!');
      expect(replied.body.data.repliedAt).not.toBeNull();

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      const review = publicList.body.data[0] as Record<string, unknown> & {
        reviewer: Record<string, unknown>;
        tradePost: Record<string, unknown>;
      };
      expect(review).toMatchObject({
        id: reviewId,
        content: 'Sầu riêng ngon, cơm vàng',
        replyContent: 'Cảm ơn bạn đã tin tưởng!',
        status: 'PUBLISHED',
      });
      expect(Object.keys(review.reviewer).sort()).toEqual([
        'avatarUrl',
        'displayName',
        'id',
      ]);
      expect(Object.keys(review.tradePost).sort()).toEqual([
        'id',
        'slug',
        'title',
      ]);
      expect(review).not.toHaveProperty('ownerId');
      expect(review).not.toHaveProperty('user');

      await request(app.getHttpServer())
        .delete(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .expect(200);
      const afterRemoval = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      expect(afterRemoval.body.data[0]).toMatchObject({
        replyContent: null,
        repliedAt: null,
        customerReplies: [],
      });
    });

    it('allows only the post owner to reply, with 1–500 characters, on published reviews', async () => {
      const { owner, postId } = await createPublishedPost('reply-guard');
      const { reviewId, customer } = await publishedReview(postId);
      const otherSeller = await login('reply-other', UserRole.BUSINESS);

      const notOwner = await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(otherSeller))
        .send({ content: 'Không phải tin của tôi' })
        .expect(403);
      expect(notOwner.body.error.code).toBe('REVIEW_REPLY_NOT_ALLOWED');
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(customer))
        .send({ content: 'Khách tự trả lời' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(otherSeller))
        .expect(403);

      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: '    ' })
        .expect(400);
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'x'.repeat(501) })
        .expect(400);

      const admin = await login('review-moderator', UserRole.ADMIN);
      const hiddenReviewer = await login('hidden-reviewer');
      const hidden = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews`)
        .set(auth(hiddenReviewer))
        .send({ rating: 3, content: 'Sẽ bị ẩn' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reviews/${hidden.body.data.id}/status`)
        .set(auth(admin))
        .send({ status: 'HIDDEN' })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${hidden.body.data.id}/reply`)
        .set(auth(owner))
        .send({ content: 'Trả lời đánh giá đã ẩn' })
        .expect(404);
    });

    it('lets any non-owner customer reply publicly and returns the same persisted replies in public and owner lists', async () => {
      const { owner, postId } = await createPublishedPost(
        'customer-public-reply',
      );
      const { reviewId, customer: reviewer } = await publishedReview(postId);
      const otherCustomer = await login('customer-public-reply-other');

      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Cảm ơn bạn đã đánh giá.' })
        .expect(200);
      const { reviewId: otherReviewId } = await publishedReview(postId);
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${otherReviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi cho đánh giá thứ hai.' })
        .expect(200);

      const beforePost = await prisma.tradePost.findUniqueOrThrow({
        where: { id: postId },
        select: { averageRating: true, reviewCount: true },
      });

      const first = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(otherCustomer))
        .send({
          content: '  Cảm ơn chủ tin,\nmình đã nhận được hỗ trợ.  ',
        })
        .expect(201);
      expect(first.body.data).toMatchObject({
        reviewId,
        userId: otherCustomer.userId,
        content: 'Cảm ơn chủ tin,\nmình đã nhận được hỗ trợ.',
        author: { id: otherCustomer.userId },
      });
      expect(first.body.data.createdAt).toEqual(expect.any(String));

      const second = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(reviewer))
        .send({ content: 'Tác giả đánh giá cũng có thể trao đổi tiếp.' })
        .expect(201);
      expect(second.body.data.author.id).toBe(reviewer.userId);

      const isolated = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${otherReviewId}/replies`)
        .set(auth(otherCustomer))
        .send({ content: 'Câu trả lời chỉ thuộc đánh giá thứ hai.' })
        .expect(201);

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      const publicReviews = publicList.body
        .data as ReviewWithCustomerRepliesBody[];
      const publicReview = publicReviews.find((item) => item.id === reviewId);
      expect(publicReview).toBeDefined();
      if (!publicReview) throw new Error('Review fixture not found');
      expect(publicReview.customerReplies).toHaveLength(2);
      expect(publicReview.customerReplies.map((reply) => reply.id)).toEqual([
        first.body.data.id,
        second.body.data.id,
      ]);
      expect(
        Object.keys(publicReview.customerReplies[0].author ?? {}).sort(),
      ).toEqual(['avatarUrl', 'displayName', 'id']);
      const otherPublicReview = publicReviews.find(
        (item) => item.id === otherReviewId,
      );
      expect(otherPublicReview).toBeDefined();
      if (!otherPublicReview)
        throw new Error('Second review fixture not found');
      expect(
        otherPublicReview.customerReplies.map((reply) => reply.id),
      ).toEqual([isolated.body.data.id]);

      const ownerList = await request(app.getHttpServer())
        .get('/api/v1/trade-management/reviews')
        .set(auth(owner))
        .expect(200);
      const ownerReviews = ownerList.body
        .data as ReviewWithCustomerRepliesBody[];
      const ownerReview = ownerReviews.find((item) => item.id === reviewId);
      expect(ownerReview).toBeDefined();
      if (!ownerReview) throw new Error('Owner review fixture not found');
      expect(ownerReview.customerReplies).toEqual(publicReview.customerReplies);

      const afterPost = await prisma.tradePost.findUniqueOrThrow({
        where: { id: postId },
        select: { averageRating: true, reviewCount: true },
      });
      expect(afterPost).toEqual(beforePost);

      const rows = await prisma.tradeReviewCustomerReply.findMany({
        where: { reviewId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      expect(rows.map((row) => row.id)).toEqual([
        first.body.data.id,
        second.body.data.id,
      ]);
    });

    it('validates customer reply identity, ownership, matching post and public state', async () => {
      const { owner, postId } = await createPublishedPost(
        'customer-reply-guards',
      );
      const { reviewId } = await publishedReview(postId);
      const customer = await login('customer-reply-guards-user');

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .send({ content: 'Chưa đăng nhập' })
        .expect(401);

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: '   ' })
        .expect(400);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'x'.repeat(501) })
        .expect(400);

      const spoof = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Không được giả mạo', userId: owner.userId })
        .expect(400);
      expect(spoof.body.error.code).toBe('VALIDATION_ERROR');

      const noOwnerReply = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Chưa có phản hồi chủ tin' })
        .expect(409);
      expect(noOwnerReply.body.error.code).toBe(
        'TRADE_REVIEW_OWNER_REPLY_REQUIRED',
      );

      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi để mở trao đổi' })
        .expect(200);

      const ownerAttempt = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(owner))
        .send({ content: 'Chủ tin không dùng endpoint này' })
        .expect(403);
      expect(ownerAttempt.body.error.code).toBe(
        'TRADE_REVIEW_CUSTOMER_REPLY_NOT_ALLOWED',
      );

      const { postId: otherPostId } = await createPublishedPost(
        'customer-reply-wrong-post',
      );
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${otherPostId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Review thuộc tin khác' })
        .expect(404);

      const admin = await login('customer-reply-hide-admin', UserRole.ADMIN);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reviews/${reviewId}/status`)
        .set(auth(admin))
        .send({ status: 'HIDDEN' })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Đánh giá đã bị ẩn' })
        .expect(404);

      const publicList = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      expect(publicList.body.data).toEqual([]);
    });

    it('keeps customer history when the seller reply or author disappears and blocks new replies until the seller responds again', async () => {
      const { owner, postId } = await createPublishedPost(
        'customer-reply-history',
      );
      const { reviewId } = await publishedReview(postId);
      const firstCustomer = await login('customer-reply-history-first');
      const nextCustomer = await login('customer-reply-history-next');

      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi lần đầu' })
        .expect(200);
      const created = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(firstCustomer))
        .send({ content: 'Lịch sử cần được giữ lại' })
        .expect(201);

      const edited = await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi đã chỉnh sửa' })
        .expect(200);
      expect(edited.body.data.customerReplies).toHaveLength(1);
      expect(edited.body.data.customerReplies[0].id).toBe(created.body.data.id);

      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .expect(200);
      expect(removed.body.data).toMatchObject({
        id: reviewId,
        replyContent: null,
      });
      expect(removed.body.data.customerReplies).toHaveLength(1);
      expect(removed.body.data.customerReplies[0].id).toBe(
        created.body.data.id,
      );

      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(nextCustomer))
        .send({ content: 'Bị chặn trong lúc không có phản hồi chủ tin' })
        .expect(409);

      await prisma.user.delete({ where: { id: firstCustomer.userId } });
      const afterAuthorDeletion = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      expect(afterAuthorDeletion.body.data[0].customerReplies[0]).toMatchObject(
        {
          id: created.body.data.id,
          userId: null,
          author: null,
        },
      );

      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi được tạo lại' })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(nextCustomer))
        .send({ content: 'Có thể tiếp tục trao đổi' })
        .expect(201);
    });

    it('does not expose replies after the post or review is hidden/deleted', async () => {
      const admin = await login(
        'customer-reply-visibility-admin',
        UserRole.ADMIN,
      );
      const customer = await login('customer-reply-visibility-customer');

      const { owner, postId } = await createPublishedPost(
        'customer-reply-hidden-post',
      );
      const { reviewId } = await publishedReview(postId);
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${reviewId}/reply`)
        .set(auth(owner))
        .send({ content: 'Phản hồi trước khi tin bị ẩn' })
        .expect(200);
      const postReply = await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Không được lộ sau khi tin bị ẩn' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/trade-posts/${postId}/hide`)
        .set(auth(admin))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-posts/${postId}/reviews/${reviewId}/replies`)
        .set(auth(customer))
        .send({ content: 'Tin đã bị ẩn' })
        .expect(404);
      const hiddenPostReviews = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${postId}/reviews`)
        .expect(200);
      expect(hiddenPostReviews.body.data).toEqual([]);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/trade-posts/${postId}`)
        .set(auth(admin))
        .expect(204);
      expect(
        await prisma.tradeReviewCustomerReply.findUnique({
          where: { id: postReply.body.data.id as string },
        }),
      ).not.toBeNull();

      const { owner: secondOwner, postId: secondPostId } =
        await createPublishedPost('customer-reply-deleted-review');
      const { reviewId: secondReviewId, customer: reviewer } =
        await publishedReview(secondPostId);
      await request(app.getHttpServer())
        .put(`/api/v1/trade-management/reviews/${secondReviewId}/reply`)
        .set(auth(secondOwner))
        .send({ content: 'Phản hồi trước khi review bị xóa' })
        .expect(200);
      const reviewReply = await request(app.getHttpServer())
        .post(
          `/api/v1/trade-posts/${secondPostId}/reviews/${secondReviewId}/replies`,
        )
        .set(auth(customer))
        .send({ content: 'Không được lộ sau khi review bị xóa' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${secondReviewId}`)
        .set(auth(reviewer))
        .expect(204);
      await request(app.getHttpServer())
        .post(
          `/api/v1/trade-posts/${secondPostId}/reviews/${secondReviewId}/replies`,
        )
        .set(auth(customer))
        .send({ content: 'Review đã bị xóa' })
        .expect(404);
      const deletedReviewList = await request(app.getHttpServer())
        .get(`/api/v1/trade-posts/${secondPostId}/reviews`)
        .expect(200);
      expect(deletedReviewList.body.data).toEqual([]);
      expect(
        await prisma.tradeReviewCustomerReply.findUnique({
          where: { id: reviewReply.body.data.id as string },
        }),
      ).not.toBeNull();
    });
  });

  describe('chat', () => {
    it('refuses unpublished posts and messaging your own post', async () => {
      const owner = await login('chat-draft-owner', UserRole.BUSINESS);
      const customer = await login('chat-draft-customer');
      const draftId = await createPost(owner);
      await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: draftId, message: 'Còn hàng không?' })
        .expect(404);

      const { owner: seller, postId } = await createPublishedPost('chat-self');
      const self = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(seller))
        .send({ tradePostId: postId, message: 'Tự hỏi mình' })
        .expect(403);
      expect(self.body.error.code).toBe('CANNOT_MESSAGE_OWN_POST');
    });

    it('reuses one thread per customer and post, tracks unread counts and marks only the other side read', async () => {
      const { owner, postId } = await createPublishedPost('chat');
      const customer = await login('chat-customer');

      const opened = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: postId, message: '  Còn hàng không?  ' })
        .expect(201);
      const conversationId = opened.body.data.id as string;
      expect(opened.body.data).toMatchObject({
        customerId: customer.userId,
        ownerId: owner.userId,
        counterpart: { id: owner.userId },
        tradePost: { id: postId, status: 'PUBLISHED' },
        lastMessage: { content: 'Còn hàng không?', senderId: customer.userId },
        unreadCount: 0,
      });

      const reused = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: postId, message: 'Giá bao nhiêu?' })
        .expect(201);
      expect(reused.body.data.id).toBe(conversationId);

      // The customer reading their own thread must not mark their own messages.
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-conversations/${conversationId}/read`)
        .set(auth(customer))
        .expect(204);
      const ownerInbox = await request(app.getHttpServer())
        .get('/api/v1/trade-conversations')
        .set(auth(owner))
        .expect(200);
      expect(ownerInbox.body.data[0]).toMatchObject({
        id: conversationId,
        counterpart: { id: customer.userId },
        unreadCount: 2,
        lastMessage: { content: 'Giá bao nhiêu?' },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/trade-conversations/${conversationId}/read`)
        .set(auth(owner))
        .expect(204);
      const reply = await request(app.getHttpServer())
        .post(`/api/v1/trade-conversations/${conversationId}/messages`)
        .set(auth(owner))
        .send({ content: 'Còn hàng, 120.000đ/kg.' })
        .expect(201);
      expect(reply.body.data.senderId).toBe(owner.userId);

      const ownerAfter = await request(app.getHttpServer())
        .get('/api/v1/trade-conversations')
        .set(auth(owner))
        .expect(200);
      expect(ownerAfter.body.data[0].unreadCount).toBe(0);
      const customerInbox = await request(app.getHttpServer())
        .get('/api/v1/trade-conversations')
        .set(auth(customer))
        .expect(200);
      expect(customerInbox.body.data[0]).toMatchObject({
        id: conversationId,
        unreadCount: 1,
        counterpart: { id: owner.userId },
      });

      const messages = await prisma.tradeMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages.map((message) => message.readAt !== null)).toEqual([
        true,
        true,
        false,
      ]);
    });

    it('hides a conversation from anyone outside it', async () => {
      const { postId } = await createPublishedPost('chat-private');
      const customer = await login('chat-private-customer');
      const stranger = await login('chat-stranger');
      const opened = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: postId, message: 'Xin chào' })
        .expect(201);
      const conversationId = opened.body.data.id as string;

      await request(app.getHttpServer())
        .get(`/api/v1/trade-conversations/${conversationId}/messages`)
        .set(auth(stranger))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-conversations/${conversationId}/messages`)
        .set(auth(stranger))
        .send({ content: 'Chen ngang' })
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/v1/trade-conversations/${conversationId}/read`)
        .set(auth(stranger))
        .expect(404);
      const strangerInbox = await request(app.getHttpServer())
        .get('/api/v1/trade-conversations')
        .set(auth(stranger))
        .expect(200);
      expect(strangerInbox.body.meta.total).toBe(0);
    });

    it('pages messages newest-first while keeping each page in chronological order', async () => {
      const { postId } = await createPublishedPost('chat-paging');
      const customer = await login('chat-paging-customer');
      const opened = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: postId, message: 'm1' })
        .expect(201);
      const conversationId = opened.body.data.id as string;
      for (const content of ['m2', 'm3', 'm4', 'm5']) {
        await request(app.getHttpServer())
          .post(`/api/v1/trade-conversations/${conversationId}/messages`)
          .set(auth(customer))
          .send({ content })
          .expect(201);
      }

      const page1 = await request(app.getHttpServer())
        .get(`/api/v1/trade-conversations/${conversationId}/messages`)
        .query({ page: 1, limit: 2 })
        .set(auth(customer))
        .expect(200);
      expect(
        (page1.body.data as Array<{ content: string }>).map((m) => m.content),
      ).toEqual(['m4', 'm5']);
      expect(page1.body.meta.total).toBe(5);

      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/trade-conversations/${conversationId}/messages`)
        .query({ page: 2, limit: 2 })
        .set(auth(customer))
        .expect(200);
      expect(
        (page2.body.data as Array<{ content: string }>).map((m) => m.content),
      ).toEqual(['m2', 'm3']);
    });

    it('lists conversations by most recent message first', async () => {
      const customer = await login('chat-order-customer');
      const { postId: firstPost } = await createPublishedPost('chat-order-a');
      const { postId: secondPost } = await createPublishedPost('chat-order-b');
      const first = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: firstPost, message: 'Hỏi tin A' })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/api/v1/trade-conversations')
        .set(auth(customer))
        .send({ tradePostId: secondPost, message: 'Hỏi tin B' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/trade-conversations/${first.body.data.id}/messages`)
        .set(auth(customer))
        .send({ content: 'Nhắc lại tin A' })
        .expect(201);

      const inbox = await request(app.getHttpServer())
        .get('/api/v1/trade-conversations')
        .set(auth(customer))
        .expect(200);
      expect(
        (inbox.body.data as Array<{ id: string }>).map((c) => c.id),
      ).toEqual([first.body.data.id, second.body.data.id]);
    });
  });
});
