import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BusinessType,
  MediaResourceType,
  UserRole,
  UserStatus,
} from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  userId: string;
  token: string;
}

describe('Garden harvest batches & QR trace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const mediaIds: string[] = [];

  const payload = {
    fruitName: 'Sầu riêng Ri6',
    harvestDate: '2026-10-01',
    weightKg: 12.5,
    pricePerKg: 85000,
    fertilizers: 'Phân hữu cơ vi sinh',
    pesticides: 'Không sử dụng',
  };

  async function login(
    label: string,
    role: UserRole = UserRole.USER,
    businessType: BusinessType | null = null,
  ): Promise<AuthedUser> {
    const zaloId = `zalo-harvest-${label}-${randomUUID()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.update({
      where: { zaloId },
      data: { role, businessType },
    });
    userIds.push(user.id);
    return { userId: user.id, token: res.body.data.accessToken as string };
  }

  const gardenOwner = (label: string) =>
    login(label, UserRole.BUSINESS, BusinessType.GARDEN);

  const auth = (user: AuthedUser) => ({
    Authorization: `Bearer ${user.token}`,
  });

  async function createImage(ownerId: string, label: string) {
    const id = randomUUID();
    const media = await prisma.media.create({
      data: {
        id,
        ownerId,
        storageKey: `${id}.webp`,
        originalUrl: `https://cdn.localgo.test/${label}.webp`,
        thumbnailUrl: `https://cdn.localgo.test/${label}-thumb.webp`,
        mimeType: 'image/webp',
        size: 1024,
        width: 1200,
        height: 900,
        checksum: randomUUID(),
      },
    });
    mediaIds.push(media.id);
    return media;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    await prisma.harvestBatch.deleteMany({
      where: { ownerId: { in: userIds } },
    });
    await prisma.media.deleteMany({ where: { id: { in: mediaIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('is limited to ACTIVE BUSINESS accounts of type GARDEN', async () => {
    const plain = await login('plain');
    const notBusiness = await request(app.getHttpServer())
      .get('/api/v1/harvest-batches')
      .set(auth(plain))
      .expect(403);
    expect(notBusiness.body.error.code).toBe('BUSINESS_PROFILE_REQUIRED');

    const restaurant = await login(
      'restaurant',
      UserRole.BUSINESS,
      BusinessType.RESTAURANT,
    );
    const notGarden = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(restaurant))
      .send(payload)
      .expect(403);
    expect(notGarden.body.error.code).toBe('GARDEN_ACCOUNT_REQUIRED');

    const pending = await gardenOwner('pending');
    await prisma.user.update({
      where: { id: pending.userId },
      data: { status: UserStatus.PENDING },
    });
    const notActive = await request(app.getHttpServer())
      .get('/api/v1/harvest-batches')
      .set(auth(pending))
      .expect(403);
    expect(notActive.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('declares a batch, lists it and resolves the QR code publicly', async () => {
    const admin = await login('batch-admin', UserRole.ADMIN);
    const owner = await gardenOwner('owner');
    const created = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, fruitName: '  Sầu riêng Ri6  ' })
      .expect(201);
    const batch = created.body.data;
    expect(batch.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(batch).toMatchObject({
      ownerName: 'owner',
      fruitName: 'Sầu riêng Ri6',
      harvestDate: '2026-10-01',
      weightKg: 12.5,
      pricePerKg: 85000,
      totalPrice: 1062500,
      images: [],
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/harvest-batches')
      .query({ search: 'ri6', from: '2026-10-01', to: '2026-10-01' })
      .set(auth(owner))
      .expect(200);
    const listed = list.body.data as { id: string }[];
    expect(listed.map((item) => item.id)).toEqual([batch.id]);
    expect(list.body.meta.total).toBe(1);

    const trace = await request(app.getHttpServer())
      .get(`/api/v1/harvest-trace/${(batch.code as string).toLowerCase()}`)
      .expect(200);
    expect(trace.body.data).toMatchObject({
      code: batch.code,
      gardenName: 'owner',
      ownerName: 'owner',
      fruitName: 'Sầu riêng Ri6',
      harvestDate: '2026-10-01',
      weightKg: 12.5,
      pricePerKg: 85000,
      totalPrice: 1062500,
      fertilizers: 'Phân hữu cơ vi sinh',
      pesticides: 'Không sử dụng',
    });
    expect(trace.body.data.id).toBeUndefined();
    expect(trace.body.data.ownerId).toBeUndefined();

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: admin.userId, type: 'HARVEST_BATCH_SUBMITTED' },
    });
    expect(notification.data).toEqual({
      harvestBatchId: batch.id,
      harvestCode: batch.code,
      submittedById: owner.userId,
    });
  });

  it('claims, orders, updates and publicly returns harvest batch images', async () => {
    const owner = await gardenOwner('image-owner');
    const first = await createImage(owner.userId, 'harvest-first');
    const second = await createImage(owner.userId, 'harvest-second');

    const created = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, imageIds: [second.id, first.id] })
      .expect(201);
    const batch = created.body.data as {
      id: string;
      code: string;
      images: Array<{
        id: string;
        url: string;
        thumbnailUrl: string;
        width: number;
        height: number;
        sortOrder: number;
      }>;
    };
    expect(batch.images).toEqual([
      {
        id: second.id,
        url: second.originalUrl,
        thumbnailUrl: second.thumbnailUrl,
        width: 1200,
        height: 900,
        sortOrder: 0,
      },
      {
        id: first.id,
        url: first.originalUrl,
        thumbnailUrl: first.thumbnailUrl,
        width: 1200,
        height: 900,
        sortOrder: 1,
      },
    ]);
    const claimed = await prisma.media.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { id: 'asc' },
    });
    expect(claimed).toHaveLength(2);
    expect(
      claimed.every(
        (image) =>
          image.resourceType === MediaResourceType.HARVEST_BATCH &&
          image.resourceId === batch.id,
      ),
    ).toBe(true);

    const third = await createImage(owner.userId, 'harvest-third');
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/harvest-batches/${batch.id}`)
      .set(auth(owner))
      .send({ imageIds: [third.id, second.id] })
      .expect(200);
    expect(
      (
        updated.body.data.images as Array<{ id: string; sortOrder: number }>
      ).map(({ id, sortOrder }) => ({ id, sortOrder })),
    ).toEqual([
      { id: third.id, sortOrder: 0 },
      { id: second.id, sortOrder: 1 },
    ]);
    expect(
      await prisma.media.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({
      resourceType: null,
      resourceId: null,
      deletedAt: expect.any(Date),
    });

    const trace = await request(app.getHttpServer())
      .get(`/api/v1/harvest-trace/${batch.code}`)
      .expect(200);
    expect(trace.body.data.images).toEqual([
      {
        url: third.originalUrl,
        thumbnailUrl: third.thumbnailUrl,
        width: 1200,
        height: 900,
        sortOrder: 0,
      },
      {
        url: second.originalUrl,
        thumbnailUrl: second.thumbnailUrl,
        width: 1200,
        height: 900,
        sortOrder: 1,
      },
    ]);
  });

  it('rejects duplicate image ids and media owned by another account', async () => {
    const owner = await gardenOwner('media-owner');
    const other = await gardenOwner('media-other');
    const image = await createImage(other.userId, 'foreign-harvest');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(other))
      .send({ ...payload, imageIds: [image.id, image.id] })
      .expect(400);
    expect(duplicate.body.error.code).toBe('VALIDATION_ERROR');

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, imageIds: [image.id] })
      .expect(400);
    expect(foreign.body.error.code).toBe('INVALID_HARVEST_BATCH_MEDIA');
  });

  it('rejects a harvest date after today', async () => {
    const owner = await gardenOwner('future');
    const res = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, harvestDate: '2999-01-01' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_HARVEST_DATE');

    await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, harvestDate: '2026-02-30' })
      .expect(400);
  });

  it('keeps batches private to their owner, edits in place and stops resolving after delete', async () => {
    const owner = await gardenOwner('editor');
    const other = await gardenOwner('other');
    const created = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send({ ...payload, ownerName: 'Nguyễn Văn An' })
      .expect(201);
    const { id, code } = created.body.data as { id: string; code: string };

    await request(app.getHttpServer())
      .get(`/api/v1/harvest-batches/${id}`)
      .set(auth(other))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/harvest-batches/${id}`)
      .set(auth(other))
      .send({ weightKg: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/harvest-batches/${id}`)
      .set(auth(other))
      .expect(404);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/harvest-batches/${id}`)
      .set(auth(owner))
      .send({ weightKg: 10, pesticides: 'Thuốc sinh học' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      code,
      ownerName: 'Nguyễn Văn An',
      weightKg: 10,
      totalPrice: 850000,
      pesticides: 'Thuốc sinh học',
    });

    const trace = await request(app.getHttpServer())
      .get(`/api/v1/harvest-trace/${code}`)
      .expect(200);
    expect(trace.body.data.pesticides).toBe('Thuốc sinh học');

    await request(app.getHttpServer())
      .delete(`/api/v1/harvest-batches/${id}`)
      .set(auth(owner))
      .expect(204);
    const gone = await request(app.getHttpServer())
      .get(`/api/v1/harvest-trace/${code}`)
      .expect(404);
    expect(gone.body.error.code).toBe('HARVEST_BATCH_NOT_FOUND');
    await request(app.getHttpServer())
      .get(`/api/v1/harvest-batches/${id}`)
      .set(auth(owner))
      .expect(404);
  });

  it('hides labels of blocked owners and rejects malformed codes', async () => {
    const owner = await gardenOwner('blocked');
    const created = await request(app.getHttpServer())
      .post('/api/v1/harvest-batches')
      .set(auth(owner))
      .send(payload)
      .expect(201);
    await prisma.user.update({
      where: { id: owner.userId },
      data: { status: UserStatus.BLOCKED },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/harvest-trace/${created.body.data.code}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/harvest-trace/not-a-code')
      .expect(404);
  });
});
