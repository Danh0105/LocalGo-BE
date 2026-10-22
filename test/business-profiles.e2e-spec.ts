import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BusinessType, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

interface AuthedUser {
  id: string;
  token: string;
}

describe('Business profiles CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const userIds: string[] = [];

  async function login(
    label: string,
    role: UserRole,
    businessType: BusinessType | null = null,
  ): Promise<AuthedUser> {
    const zaloId = `business-profile-${label}-${marker}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:${label}` })
      .expect(201);
    const user = await prisma.user.update({
      where: { zaloId },
      data: { role, businessType },
    });
    userIds.push(user.id);
    return { id: user.id, token: response.body.data.accessToken as string };
  }

  const auth = (user: AuthedUser) => ({
    Authorization: `Bearer ${user.token}`,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    await prisma.businessProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('requires an active BUSINESS account and role-specific fields', async () => {
    const plain = await login('plain', UserRole.USER);
    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/business-profiles')
      .set(auth(plain))
      .send({
        businessName: 'Tài khoản thường',
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        contactEmail: `plain-${marker}@example.com`,
        address: 'Tây Ninh',
      })
      .expect(403);
    expect(forbidden.body.error.code).toBe('BUSINESS_ACCOUNT_REQUIRED');

    const garden = await login(
      'missing-products',
      UserRole.BUSINESS,
      BusinessType.GARDEN,
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/business-profiles')
      .set(auth(garden))
      .send({
        businessName: 'Vườn thiếu sản phẩm',
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        contactEmail: `${marker}@example.com`,
        address: 'Truông Mít, Tây Ninh',
      })
      .expect(400);
    expect(response.body.error.message).toContain('Sản phẩm/cây trồng chính');
  });

  it('lets an owner create, read, update, publish and delete a complete profile', async () => {
    const garden = await login(
      'garden-owner',
      UserRole.BUSINESS,
      BusinessType.GARDEN,
    );
    const created = await request(app.getHttpServer())
      .post('/api/v1/business-profiles')
      .set(auth(garden))
      .send({
        businessName: `Vườn Mãng Cầu ${marker}`,
        businessCategory: 'Vườn cây ăn trái',
        gardenArea: '2 ha',
        mainProducts: 'Mãng cầu, bưởi da xanh',
        contactName: 'Nguyễn Văn Vườn',
        contactPhone: '0912345678',
        contactEmail: `garden-${marker}@example.com`,
        address: 'Truông Mít, Tây Ninh',
        googleMapsUrl: 'https://www.google.com/maps?q=11.1,106.1',
        lat: 11.1,
        lng: 106.1,
        website: 'https://example.com/garden',
        facebookUrl: 'https://facebook.com/localgo',
        zaloOaUrl: 'https://zalo.me/123456789',
        logoUrl: 'https://example.com/logo.webp',
        coverImageUrl: 'https://example.com/cover.webp',
        description: 'Nhà vườn canh tác theo hướng hữu cơ.',
      })
      .expect(201);
    const profileId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      userId: garden.id,
      businessType: 'GARDEN',
      gardenArea: '2 ha',
      mainProducts: 'Mãng cầu, bưởi da xanh',
      templeName: null,
      isPublic: true,
      version: 1,
    });

    const mine = await request(app.getHttpServer())
      .get('/api/v1/business-profiles/me')
      .set(auth(garden))
      .expect(200);
    expect(mine.body.data.id).toBe(profileId);

    const publicDetail = await request(app.getHttpServer())
      .get(`/api/v1/business-profiles/${garden.id}`)
      .expect(200);
    expect(publicDetail.body.data.id).toBe(profileId);

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/business-profiles/me')
      .set(auth(garden))
      .send({ version: 1, gardenArea: '2.5 ha' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      gardenArea: '2.5 ha',
      version: 2,
    });

    const stale = await request(app.getHttpServer())
      .patch('/api/v1/business-profiles/me')
      .set(auth(garden))
      .send({ version: 1, description: 'Ghi đè dữ liệu cũ' })
      .expect(409);
    expect(stale.body.error.code).toBe('BUSINESS_PROFILE_VERSION_CONFLICT');

    const list = await request(app.getHttpServer())
      .get('/api/v1/business-profiles')
      .query({ businessType: 'GARDEN', search: marker })
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).map((item) => item.id),
    ).toContain(profileId);

    await request(app.getHttpServer())
      .delete('/api/v1/business-profiles/me')
      .set(auth(garden))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/business-profiles/${profileId}`)
      .expect(404);

    const restored = await request(app.getHttpServer())
      .post('/api/v1/business-profiles')
      .set(auth(garden))
      .send({
        businessName: `Vườn phục hồi ${marker}`,
        mainProducts: 'Bưởi',
        contactName: 'Nguyễn Văn Vườn',
        contactPhone: '0912345678',
        contactEmail: `garden-${marker}@example.com`,
        address: 'Tây Ninh',
      })
      .expect(201);
    expect(restored.body.data).toMatchObject({
      id: profileId,
      isPublic: true,
      version: 4,
    });
  });

  it('provides admin read/update/delete operations', async () => {
    const [admin, restaurant] = await Promise.all([
      login('admin', UserRole.ADMIN),
      login('restaurant', UserRole.BUSINESS, BusinessType.RESTAURANT),
    ]);
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/business-profiles')
      .set(auth(admin))
      .send({
        userId: restaurant.id,
        businessName: `Quán ăn ${marker}`,
        openingHours: '06:00 - 22:00',
        seatingCapacity: 80,
        roomCount: 10,
        contactName: 'Chủ quán',
        contactPhone: '0987654321',
        contactEmail: `restaurant-${marker}@example.com`,
        address: 'Tây Ninh',
      })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      businessType: 'RESTAURANT',
      seatingCapacity: 80,
      roomCount: null,
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/business-profiles/${id}`)
      .set(auth(admin))
      .expect(200);
    expect(detail.body.data.id).toBe(id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/business-profiles/${id}`)
      .set(auth(admin))
      .send({ version: 1, seatingCapacity: 100 })
      .expect(200);
    expect(updated.body.data.seatingCapacity).toBe(100);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/business-profiles/${id}`)
      .set(auth(admin))
      .expect(204);

    const deleted = await request(app.getHttpServer())
      .get('/api/v1/admin/business-profiles')
      .set(auth(admin))
      .query({ includeDeleted: true, search: marker })
      .expect(200);
    expect(
      (
        deleted.body.data as Array<{ id: string; deletedAt: string | null }>
      ).find((item) => item.id === id)?.deletedAt,
    ).not.toBeNull();
  });
});
