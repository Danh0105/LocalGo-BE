import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ChatbotKnowledgeService {
  private cachedContext?: { value: string; expiresAt: number };

  constructor(private readonly prisma: PrismaService) {}

  async getPublicTourismContext(): Promise<string> {
    if (this.cachedContext && this.cachedContext.expiresAt > Date.now()) {
      return this.cachedContext.value;
    }

    const [
      temples,
      specialties,
      historicalSites,
      agricultureItems,
      ocopProducts,
      craftVillages,
      cuisineItems,
      festivals,
      experienceTours,
      mapPlaces,
      contacts,
      newsArticles,
      aboutPage,
    ] = await Promise.all([
      this.prisma.temple.findMany({
        where: { isActive: true },
        include: { events: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.specialty.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.historicalSite.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.agricultureItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.ocopProduct.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.craftVillage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.cuisineItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.festival.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.experienceTour.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.mapPlace.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.contact.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.newsArticle.findMany({
        where: { isActive: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.aboutPage.findFirst({
        select: { publishedSnapshot: true },
      }),
    ]);

    const sections = [
      { type: 'den_chua_mieu', records: temples },
      { type: 'dac_san', records: specialties },
      { type: 'di_tich_lich_su', records: historicalSites },
      { type: 'nong_nghiep', records: agricultureItems },
      { type: 'san_pham_ocop', records: ocopProducts },
      { type: 'lang_nghe', records: craftVillages },
      { type: 'am_thuc', records: cuisineItems },
      { type: 'le_hoi', records: festivals },
      { type: 'tour_trai_nghiem', records: experienceTours },
      { type: 'dia_diem_ban_do', records: mapPlaces },
      { type: 'lien_he_ho_tro', records: contacts },
      { type: 'tin_tuc', records: newsArticles },
      {
        type: 'gioi_thieu_dia_phuong',
        records: aboutPage?.publishedSnapshot
          ? [aboutPage.publishedSnapshot]
          : [],
      },
    ];

    const ignoredKeys = new Set([
      'createdById',
      'updatedById',
      'createdAt',
      'updatedAt',
      'version',
      'isActive',
      'sortOrder',
      'mediaId',
      'deletedAt',
    ]);
    const value = JSON.stringify(sections, (key, fieldValue: unknown) =>
      ignoredKeys.has(key) ? undefined : fieldValue,
    );

    this.cachedContext = { value, expiresAt: Date.now() + 5 * 60_000 };
    return value;
  }
}
