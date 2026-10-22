import { type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  MapPlaceCategory,
  NewsCategory,
  TempleType,
  UserRole,
} from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Global search (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const token = `search${marker.slice(0, 8)}`;
  const userIds: string[] = [];
  const ids = {
    temple: `temple-${marker}`,
    hiddenTemple: `temple-hidden-${marker}`,
    news: `news-${marker}`,
    mapUbnd: `map-ubnd-${marker}`,
    mapFood: `map-food-${marker}`,
  };

  async function loginAdmin() {
    const zaloId = `search-admin-${marker}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/zalo')
      .send({ accessToken: `mock:${zaloId}:Search Admin` })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { zaloId } });
    userIds.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    return response.body.data.accessToken as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.temple.createMany({
      data: [
        {
          id: ids.temple,
          name: `Mãng Cầu ${token}`,
          type: TempleType.DINH,
          address: 'Truông Mít',
          openHours: 'Cả ngày',
          summary: 'Kết quả tìm kiếm công khai.',
          description: ['Nội dung kiểm thử search.'],
          isActive: true,
        },
        {
          id: ids.hiddenTemple,
          name: `Điểm Ẩn ${token}`,
          type: TempleType.MIEU,
          address: 'Truông Mít',
          openHours: 'Cả ngày',
          summary: 'Chỉ quản trị viên được tìm thấy.',
          description: ['Nội dung ẩn.'],
          isActive: false,
        },
      ],
    });
    await prisma.newsArticle.create({
      data: {
        id: ids.news,
        title: `Tin Mãng Cầu ${token}`,
        category: NewsCategory.NONG_NGHIEP,
        publishedAt: new Date(Date.now() - 60_000),
        author: 'LocalGo',
        summary: 'Tin tức dùng kiểm thử tìm kiếm toàn cục.',
        content: ['Nội dung kiểm thử search.'],
        tags: ['mãng cầu'],
        relatedLinks: [],
        isActive: true,
      },
    });
    await prisma.mapPlace.createMany({
      data: [
        {
          id: ids.mapUbnd,
          name: `UBND xã ${token}`,
          category: MapPlaceCategory.HANH_CHINH,
          address: 'Trung tâm xã',
          lat: 11.24,
          lng: 106.2,
          openTime: 'Giờ hành chính',
          distanceFromCenter: '0 km',
          summary: 'Cơ quan hành chính địa phương.',
          description: [],
          highlights: [],
          directionNote: '',
          isActive: true,
        },
        {
          id: ids.mapFood,
          name: `Quán địa phương ${token}`,
          category: MapPlaceCategory.AM_THUC,
          address: 'Trung tâm xã',
          lat: 11.23,
          lng: 106.21,
          openTime: 'Cả ngày',
          distanceFromCenter: '1 km',
          summary: 'Địa điểm dùng bữa.',
          description: [],
          highlights: [],
          directionNote: '',
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    if (!app || !prisma) return;
    await prisma.newsArticle.deleteMany({ where: { id: ids.news } });
    await prisma.mapPlace.deleteMany({
      where: { id: { in: [ids.mapUbnd, ids.mapFood] } },
    });
    await prisma.temple.deleteMany({
      where: { id: { in: [ids.temple, ids.hiddenTemple] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('searches across resource types without requiring Vietnamese accents', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `mang cau ${token}`, types: 'TEMPLE,NEWS', limit: 10 })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceType: 'TEMPLE',
          id: ids.temple,
        }),
        expect.objectContaining({ resourceType: 'NEWS', id: ids.news }),
      ]),
    );
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('supports unordered prefixes and full-text fields', async () => {
    const unordered = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `${token} cau man`, types: 'TEMPLE,NEWS', limit: 10 })
      .expect(200);

    expect(unordered.body.meta.total).toBe(2);
    const unorderedData = unordered.body.data as Array<{ id: string }>;
    expect(unorderedData.map((item) => item.id)).toEqual(
      expect.arrayContaining([ids.temple, ids.news]),
    );

    const keyword = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `truong mit ${token}`, types: 'TEMPLE' })
      .expect(200);

    expect(keyword.body.data).toEqual([
      expect.objectContaining({ id: ids.temple, resourceType: 'TEMPLE' }),
    ]);

    const label = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `den ${token}`, types: 'TEMPLE' })
      .expect(200);

    expect(label.body.data).toEqual([
      expect.objectContaining({ id: ids.temple, resourceType: 'TEMPLE' }),
    ]);
  });

  it('keeps total metadata when a requested page has no rows', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({
        q: `mang cau ${token}`,
        types: 'TEMPLE,NEWS',
        page: 99,
        limit: 10,
      })
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toMatchObject({
      page: 99,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('tolerates a minor title typo without matching unrelated titles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `mang cauu ${token}`, types: 'TEMPLE' })
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ id: ids.temple, resourceType: 'TEMPLE' }),
    ]);
    expect(response.body.meta.total).toBe(1);
  });

  it('finds content through related topics and common abbreviations', async () => {
    const cases = [
      {
        q: `chùa chiền ${token}`,
        types: 'TEMPLE',
        expectedId: ids.temple,
      },
      {
        q: `ăn uống ${token}`,
        types: 'MAP_PLACE',
        expectedId: ids.mapFood,
      },
      {
        q: `ủy ban nhân dẫn ${token}`,
        types: 'MAP_PLACE',
        expectedId: ids.mapUbnd,
      },
    ];

    for (const testCase of cases) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search')
        .query({ q: testCase.q, types: testCase.types })
        .expect(200);
      expect(response.body.data).toEqual([
        expect.objectContaining({ id: testCase.expectedId }),
      ]);
    }
  });

  it('excludes hidden content from public search', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: `diem an ${token}`, types: 'TEMPLE' })
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('lets admins search hidden content and exposes its status', async () => {
    const tokenValue = await loginAdmin();
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/search')
      .set('Authorization', `Bearer ${tokenValue}`)
      .query({ q: `diem an ${token}`, types: 'TEMPLE' })
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({
        resourceType: 'TEMPLE',
        id: ids.hiddenTemple,
        status: 'HIDDEN',
      }),
    ]);
  });

  it('validates the query and protects the admin endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'a' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/search')
      .query({ q: token })
      .expect(401);
  });
});
