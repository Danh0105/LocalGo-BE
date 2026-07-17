import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import {
  Prisma,
  PrismaClient,
  MediaResourceType,
  TradePostCategory,
  TradePostPriceType,
  TradePostStatus,
  TradeReviewStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma';
import { ABOUT_INITIAL_SNAPSHOT } from './about-seed-data';
import { TEMPLE_SEED_DATA } from './temple-seed-data';
import { SPECIALTY_SEED_DATA } from './specialty-seed-data';
import { HISTORICAL_SITE_SEED_DATA } from './historical-site-seed-data';
import { AGRICULTURE_SEED_DATA } from './agriculture-seed-data';
import { OCOP_SEED_DATA } from './ocop-seed-data';
import { CRAFT_VILLAGE_SEED_DATA } from './craft-village-seed-data';
import { CUISINE_SEED_DATA } from './cuisine-seed-data';
import { FESTIVAL_SEED_DATA } from './festival-seed-data';
import { EXPERIENCE_TOUR_SEED_DATA } from './experience-tour-seed-data';
import { FEEDBACK_CHANNEL_SEED_DATA } from './feedback-channel-seed-data';
import { MAP_PLACE_SEED_DATA } from './map-place-seed-data';
import { CONTACT_SEED_DATA } from './contact-seed-data';
import { NEWS_SEED_DATA } from './news-seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Idempotent: every create below is an upsert keyed on a unique field, so
 * re-running this script against an already-seeded database updates in
 * place rather than duplicating rows.
 */
async function main(): Promise<void> {
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@localgo.local';
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const admin = await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {},
    create: {
      email: seedAdminEmail,
      displayName: 'Quản trị viên LocalGo',
      passwordHash: await argon2.hash(seedAdminPassword),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const aboutSnapshot =
    ABOUT_INITIAL_SNAPSHOT as unknown as Prisma.InputJsonValue;
  const aboutPage = await prisma.aboutPage.upsert({
    where: { id: 'about' },
    update: {},
    create: {
      id: 'about',
      draftSnapshot: aboutSnapshot,
      publishedSnapshot: aboutSnapshot,
      version: 1,
      publishedVersion: 1,
      createdById: admin.id,
      updatedById: admin.id,
      publishedById: admin.id,
      publishedAt: new Date(),
    },
  });
  await prisma.aboutRevision.upsert({
    where: {
      aboutPageId_version: { aboutPageId: aboutPage.id, version: 1 },
    },
    update: {},
    create: {
      aboutPageId: aboutPage.id,
      version: 1,
      snapshot: aboutSnapshot,
      publishedById: admin.id,
      publishedAt: aboutPage.publishedAt ?? new Date(),
    },
  });

  // ---------- Đền - Chùa - Miếu ----------
  // An optional shared placeholder must already be an uploaded image. It is
  // marked TEMPLE with no resourceId so all six initial records can reuse it.
  const placeholderMediaId = process.env.TEMPLE_PLACEHOLDER_MEDIA_ID;
  const placeholderMedia = placeholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: placeholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (placeholderMedia) {
    await prisma.media.update({
      where: { id: placeholderMedia.id },
      data: { resourceType: MediaResourceType.TEMPLE, resourceId: null },
    });
  }
  for (const [sortOrder, temple] of TEMPLE_SEED_DATA.entries()) {
    await prisma.temple.upsert({
      where: { id: temple.id },
      update: {},
      create: {
        id: temple.id,
        name: temple.name,
        type: temple.type,
        address: temple.address,
        openHours: temple.openHours,
        summary: temple.summary,
        description: temple.description,
        mediaId: placeholderMedia?.id,
        imageAlt: temple.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
        events: {
          create: temple.events.map((event, eventSortOrder) => ({
            id: deterministicSeedId(temple.id, `event-${eventSortOrder}`),
            ...event,
            sortOrder: eventSortOrder,
          })),
        },
      },
    });
  }

  // ---------- Đặc sản ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const specialtyPlaceholderMediaId = process.env.SPECIALTY_PLACEHOLDER_MEDIA_ID;
  const specialtyPlaceholderMedia = specialtyPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: specialtyPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (specialtyPlaceholderMedia) {
    await prisma.media.update({
      where: { id: specialtyPlaceholderMedia.id },
      data: { resourceType: MediaResourceType.SPECIALTY, resourceId: null },
    });
  }
  for (const [sortOrder, specialty] of SPECIALTY_SEED_DATA.entries()) {
    await prisma.specialty.upsert({
      where: { id: specialty.id },
      update: {},
      create: {
        id: specialty.id,
        name: specialty.name,
        category: specialty.category,
        price: specialty.price,
        season: specialty.season,
        summary: specialty.summary,
        description: specialty.description,
        buyPlaces: specialty.buyPlaces,
        mediaId: specialtyPlaceholderMedia?.id,
        imageAlt: specialty.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Di tích lịch sử ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const historicalSitePlaceholderMediaId =
    process.env.HISTORICAL_SITE_PLACEHOLDER_MEDIA_ID;
  const historicalSitePlaceholderMedia = historicalSitePlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: historicalSitePlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (historicalSitePlaceholderMedia) {
    await prisma.media.update({
      where: { id: historicalSitePlaceholderMedia.id },
      data: {
        resourceType: MediaResourceType.HISTORICAL_SITE,
        resourceId: null,
      },
    });
  }
  for (const [sortOrder, site] of HISTORICAL_SITE_SEED_DATA.entries()) {
    await prisma.historicalSite.upsert({
      where: { id: site.id },
      update: {},
      create: {
        id: site.id,
        name: site.name,
        rank: site.rank,
        address: site.address,
        recognizedYear: site.recognizedYear,
        summary: site.summary,
        history: site.history,
        highlights: site.highlights,
        mediaId: historicalSitePlaceholderMedia?.id,
        imageAlt: site.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Nông nghiệp ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const agriculturePlaceholderMediaId =
    process.env.AGRICULTURE_PLACEHOLDER_MEDIA_ID;
  const agriculturePlaceholderMedia = agriculturePlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: agriculturePlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (agriculturePlaceholderMedia) {
    await prisma.media.update({
      where: { id: agriculturePlaceholderMedia.id },
      data: { resourceType: MediaResourceType.AGRICULTURE, resourceId: null },
    });
  }
  for (const [sortOrder, item] of AGRICULTURE_SEED_DATA.entries()) {
    await prisma.agricultureItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        name: item.name,
        category: item.category,
        location: item.location,
        season: item.season,
        scale: item.scale,
        summary: item.summary,
        description: item.description,
        highlights: item.highlights,
        support: item.support,
        mediaId: agriculturePlaceholderMedia?.id,
        imageAlt: item.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- OCOP ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const ocopPlaceholderMediaId = process.env.OCOP_PLACEHOLDER_MEDIA_ID;
  const ocopPlaceholderMedia = ocopPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: ocopPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (ocopPlaceholderMedia) {
    await prisma.media.update({
      where: { id: ocopPlaceholderMedia.id },
      data: { resourceType: MediaResourceType.OCOP, resourceId: null },
    });
  }
  for (const [sortOrder, product] of OCOP_SEED_DATA.entries()) {
    await prisma.ocopProduct.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        name: product.name,
        category: product.category,
        rating: product.rating,
        producer: product.producer,
        address: product.address,
        priceRange: product.priceRange,
        summary: product.summary,
        description: product.description,
        highlights: product.highlights,
        contactNote: product.contactNote,
        mediaId: ocopPlaceholderMedia?.id,
        imageAlt: product.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Làng nghề ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const craftVillagePlaceholderMediaId =
    process.env.CRAFT_VILLAGE_PLACEHOLDER_MEDIA_ID;
  const craftVillagePlaceholderMedia = craftVillagePlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: craftVillagePlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (craftVillagePlaceholderMedia) {
    await prisma.media.update({
      where: { id: craftVillagePlaceholderMedia.id },
      data: {
        resourceType: MediaResourceType.CRAFT_VILLAGE,
        resourceId: null,
      },
    });
  }
  for (const [sortOrder, village] of CRAFT_VILLAGE_SEED_DATA.entries()) {
    await prisma.craftVillage.upsert({
      where: { id: village.id },
      update: {},
      create: {
        id: village.id,
        name: village.name,
        category: village.category,
        address: village.address,
        workingTime: village.workingTime,
        mainProducts: village.mainProducts,
        summary: village.summary,
        description: village.description,
        highlights: village.highlights,
        visitorNote: village.visitorNote,
        mediaId: craftVillagePlaceholderMedia?.id,
        imageAlt: village.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Ẩm thực ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const cuisinePlaceholderMediaId = process.env.CUISINE_PLACEHOLDER_MEDIA_ID;
  const cuisinePlaceholderMedia = cuisinePlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: cuisinePlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (cuisinePlaceholderMedia) {
    await prisma.media.update({
      where: { id: cuisinePlaceholderMedia.id },
      data: { resourceType: MediaResourceType.CUISINE, resourceId: null },
    });
  }
  for (const [sortOrder, item] of CUISINE_SEED_DATA.entries()) {
    await prisma.cuisineItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        name: item.name,
        category: item.category,
        priceRange: item.priceRange,
        bestTime: item.bestTime,
        suggestedPlaces: item.suggestedPlaces as unknown as Prisma.InputJsonValue,
        summary: item.summary,
        description: item.description,
        highlights: item.highlights,
        tip: item.tip,
        mediaId: cuisinePlaceholderMedia?.id,
        imageAlt: item.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Lễ hội ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const festivalPlaceholderMediaId = process.env.FESTIVAL_PLACEHOLDER_MEDIA_ID;
  const festivalPlaceholderMedia = festivalPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: festivalPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (festivalPlaceholderMedia) {
    await prisma.media.update({
      where: { id: festivalPlaceholderMedia.id },
      data: { resourceType: MediaResourceType.FESTIVAL, resourceId: null },
    });
  }
  for (const [sortOrder, festival] of FESTIVAL_SEED_DATA.entries()) {
    await prisma.festival.upsert({
      where: { id: festival.id },
      update: {},
      create: {
        id: festival.id,
        name: festival.name,
        category: festival.category,
        time: festival.time,
        location: festival.location,
        scale: festival.scale,
        summary: festival.summary,
        description: festival.description,
        activities: festival.activities,
        note: festival.note,
        mediaId: festivalPlaceholderMedia?.id,
        imageAlt: festival.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Tour trải nghiệm ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const experienceTourPlaceholderMediaId =
    process.env.EXPERIENCE_TOUR_PLACEHOLDER_MEDIA_ID;
  const experienceTourPlaceholderMedia = experienceTourPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: experienceTourPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (experienceTourPlaceholderMedia) {
    await prisma.media.update({
      where: { id: experienceTourPlaceholderMedia.id },
      data: {
        resourceType: MediaResourceType.EXPERIENCE_TOUR,
        resourceId: null,
      },
    });
  }
  for (const [sortOrder, tour] of EXPERIENCE_TOUR_SEED_DATA.entries()) {
    await prisma.experienceTour.upsert({
      where: { id: tour.id },
      update: {},
      create: {
        id: tour.id,
        name: tour.name,
        category: tour.category,
        duration: tour.duration,
        startTime: tour.startTime,
        priceRange: tour.priceRange,
        meetingPoint: tour.meetingPoint,
        summary: tour.summary,
        description: tour.description,
        itinerary: tour.itinerary,
        included: tour.included,
        note: tour.note,
        mediaId: experienceTourPlaceholderMedia?.id,
        imageAlt: tour.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Phản hồi (kênh) ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const feedbackChannelPlaceholderMediaId =
    process.env.FEEDBACK_CHANNEL_PLACEHOLDER_MEDIA_ID;
  const feedbackChannelPlaceholderMedia = feedbackChannelPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: feedbackChannelPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (feedbackChannelPlaceholderMedia) {
    await prisma.media.update({
      where: { id: feedbackChannelPlaceholderMedia.id },
      data: {
        resourceType: MediaResourceType.FEEDBACK_CHANNEL,
        resourceId: null,
      },
    });
  }
  for (const [sortOrder, channel] of FEEDBACK_CHANNEL_SEED_DATA.entries()) {
    await prisma.feedbackChannel.upsert({
      where: { id: channel.id },
      update: {},
      create: {
        id: channel.id,
        title: channel.title,
        category: channel.category,
        responseTime: channel.responseTime,
        requiredInfo: channel.requiredInfo,
        summary: channel.summary,
        description: channel.description,
        examples: channel.examples,
        note: channel.note,
        mediaId: feedbackChannelPlaceholderMedia?.id,
        imageAlt: channel.title,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Bản đồ ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const mapPlacePlaceholderMediaId = process.env.MAP_PLACE_PLACEHOLDER_MEDIA_ID;
  const mapPlacePlaceholderMedia = mapPlacePlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: mapPlacePlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (mapPlacePlaceholderMedia) {
    await prisma.media.update({
      where: { id: mapPlacePlaceholderMedia.id },
      data: { resourceType: MediaResourceType.MAP_PLACE, resourceId: null },
    });
  }
  for (const [sortOrder, place] of MAP_PLACE_SEED_DATA.entries()) {
    await prisma.mapPlace.upsert({
      where: { id: place.id },
      update: {},
      create: {
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        openTime: place.openTime,
        distanceFromCenter: place.distanceFromCenter,
        summary: place.summary,
        description: place.description,
        highlights: place.highlights,
        directionNote: place.directionNote,
        mediaId: mapPlacePlaceholderMedia?.id,
        imageAlt: place.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Liên hệ ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  // NOTE: phone/email trong CONTACT_SEED_DATA là dữ liệu mẫu, cần được đơn
  // vị vận hành xác nhận và cập nhật lại qua admin API trước khi phát hành.
  const contactPlaceholderMediaId = process.env.CONTACT_PLACEHOLDER_MEDIA_ID;
  const contactPlaceholderMedia = contactPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: contactPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (contactPlaceholderMedia) {
    await prisma.media.update({
      where: { id: contactPlaceholderMedia.id },
      data: { resourceType: MediaResourceType.CONTACT, resourceId: null },
    });
  }
  for (const [sortOrder, contact] of CONTACT_SEED_DATA.entries()) {
    await prisma.contact.upsert({
      where: { id: contact.id },
      update: {},
      create: {
        id: contact.id,
        name: contact.name,
        category: contact.category,
        role: contact.role,
        phone: contact.phone,
        email: contact.email ?? null,
        address: contact.address,
        workingTime: contact.workingTime,
        summary: contact.summary,
        description: contact.description,
        supportTopics: contact.supportTopics,
        note: contact.note,
        mediaId: contactPlaceholderMedia?.id,
        imageAlt: contact.name,
        sortOrder,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  // ---------- Tin tức ----------
  // Same optional shared placeholder pattern as Đền - Chùa - Miếu above.
  const newsPlaceholderMediaId = process.env.NEWS_PLACEHOLDER_MEDIA_ID;
  const newsPlaceholderMedia = newsPlaceholderMediaId
    ? await prisma.media.findFirst({
        where: {
          id: newsPlaceholderMediaId,
          deletedAt: null,
          mimeType: { startsWith: 'image/' },
        },
      })
    : null;
  if (newsPlaceholderMedia) {
    await prisma.media.update({
      where: { id: newsPlaceholderMedia.id },
      data: { resourceType: MediaResourceType.NEWS_ARTICLE, resourceId: null },
    });
  }
  for (const article of NEWS_SEED_DATA) {
    await prisma.newsArticle.upsert({
      where: { id: article.id },
      update: {},
      create: {
        id: article.id,
        title: article.title,
        category: article.category,
        publishedAt: new Date(article.publishedAt),
        author: article.author,
        summary: article.summary,
        content: article.content,
        tags: article.tags,
        relatedLinks: article.relatedLinks,
        mediaId: newsPlaceholderMedia?.id,
        imageAlt: article.title,
        isActive: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'moderator@localgo.local' },
    update: {},
    create: {
      email: 'moderator@localgo.local',
      displayName: 'Kiểm duyệt viên',
      passwordHash: await argon2.hash('Moderator@123456'),
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
    },
  });

  const business1 = await prisma.user.upsert({
    where: { zaloId: 'seed-business-1' },
    update: {},
    create: {
      zaloId: 'seed-business-1',
      displayName: 'Vườn Bưởi Truông Mít',
      role: UserRole.BUSINESS,
      status: UserStatus.ACTIVE,
    },
  });

  const business2 = await prisma.user.upsert({
    where: { zaloId: 'seed-business-2' },
    update: {},
    create: {
      zaloId: 'seed-business-2',
      displayName: 'Cơ sở bánh tráng Tây Ninh',
      role: UserRole.BUSINESS,
      status: UserStatus.ACTIVE,
    },
  });

  const users = await Promise.all(
    ['seed-user-1', 'seed-user-2', 'seed-user-3'].map((zaloId, index) =>
      prisma.user.upsert({
        where: { zaloId },
        update: {},
        create: {
          zaloId,
          displayName: `Người dùng mẫu ${index + 1}`,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      }),
    ),
  );

  // ---------- Category (shared infra, no real consumer yet — see docs/assumptions.md) ----------
  await Promise.all(
    [
      { domain: 'AGRICULTURE', slug: 'cay-an-trai', name: 'Cây ăn trái' },
      { domain: 'AGRICULTURE', slug: 'chan-nuoi', name: 'Chăn nuôi' },
      { domain: 'NEWS', slug: 'thong-bao', name: 'Thông báo' },
    ].map((c) =>
      prisma.category.upsert({
        where: { domain_slug: { domain: c.domain, slug: c.slug } },
        update: {},
        create: c,
      }),
    ),
  );

  // ---------- Trade posts (representative fixtures across every status) ----------
  const tradePostFixtures = [
    {
      slug: 'buoi-da-xanh-truong-mit',
      ownerId: business1.id,
      category: TradePostCategory.PRODUCT,
      title: 'Bưởi da xanh Truông Mít chính gốc',
      summary: 'Bưởi da xanh trồng theo hướng hữu cơ, ngọt thanh, ít hạt.',
      description:
        'Vườn bưởi da xanh hơn 5 năm tuổi tại xã Truông Mít, chăm sóc theo hướng hữu cơ, thu hoạch quanh năm. Giao hàng tận nơi trong khu vực Tây Ninh.',
      priceType: TradePostPriceType.FIXED,
      price: 45000,
      priceLabel: '45.000đ/kg',
      address: 'Ấp 3, xã Truông Mít, Tây Ninh',
      contactName: 'Nguyễn Văn Bưởi',
      contactPhone: '0901111111',
      status: TradePostStatus.PUBLISHED,
    },
    {
      slug: 'banh-trang-phoi-suong-tay-ninh',
      ownerId: business2.id,
      category: TradePostCategory.PRODUCT,
      title: 'Bánh tráng phơi sương Tây Ninh',
      summary: 'Bánh tráng phơi sương thủ công, dẻo mềm, đúng vị đặc sản.',
      description:
        'Sản xuất theo phương pháp truyền thống, phơi sương tự nhiên qua đêm. Đóng gói sẵn, tiện lợi mang đi xa.',
      priceType: TradePostPriceType.FIXED,
      price: 60000,
      priceLabel: '60.000đ/gói',
      address: 'Chợ Long Hoa, Tây Ninh',
      contactName: 'Trần Thị Tráng',
      contactPhone: '0902222222',
      status: TradePostStatus.PUBLISHED,
    },
    {
      slug: 'dich-vu-cho-thue-xe-dien-tham-quan',
      ownerId: business1.id,
      category: TradePostCategory.SERVICE,
      title: 'Dịch vụ cho thuê xe điện tham quan',
      summary: 'Cho thuê xe điện tham quan các điểm du lịch trong xã.',
      description:
        'Xe điện 4-8 chỗ, tài xế thông thạo địa bàn, hỗ trợ thuyết minh điểm tham quan.',
      priceType: TradePostPriceType.NEGOTIABLE,
      priceLabel: 'Liên hệ báo giá theo giờ',
      address: 'Trung tâm xã Truông Mít, Tây Ninh',
      contactName: 'Lê Văn Xe',
      contactPhone: '0903333333',
      status: TradePostStatus.PENDING,
    },
    {
      slug: 'can-mua-dua-hau-so-luong-lon',
      ownerId: business2.id,
      category: TradePostCategory.BUY_REQUEST,
      title: 'Cần mua dưa hấu số lượng lớn',
      summary: 'Thu mua dưa hấu cho vựa trái cây, số lượng lớn, giá tốt.',
      description:
        'Cần thu mua dưa hấu loại 1 với số lượng từ 1 tấn trở lên, thanh toán ngay khi nhận hàng.',
      priceType: TradePostPriceType.CONTACT,
      address: 'Xã Truông Mít, Tây Ninh',
      contactName: 'Phạm Văn Mua',
      contactPhone: '0904444444',
      status: TradePostStatus.DRAFT,
    },
    {
      slug: 'khuyen-mai-dac-san-dip-le',
      ownerId: business1.id,
      category: TradePostCategory.PROMOTION,
      title: 'Khuyến mãi đặc sản dịp lễ',
      summary: 'Giảm giá 20% cho combo đặc sản dịp lễ hội truyền thống.',
      description:
        'Áp dụng cho combo bưởi da xanh + bánh tráng phơi sương, số lượng có hạn.',
      priceType: TradePostPriceType.FIXED,
      price: 80000,
      priceLabel: '80.000đ/combo (đã giảm 20%)',
      address: 'Ấp 3, xã Truông Mít, Tây Ninh',
      contactName: 'Nguyễn Văn Bưởi',
      contactPhone: '0901111111',
      promotionPercent: 20,
      promotionStartAt: new Date(),
      promotionEndAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      status: TradePostStatus.PUBLISHED,
    },
    {
      slug: 'dac-san-mut-me-truong-mit',
      ownerId: business2.id,
      category: TradePostCategory.PRODUCT,
      title: 'Mứt me Truông Mít',
      summary: 'Mứt me chua ngọt, đặc sản địa phương, đã ngừng kinh doanh.',
      description: 'Sản phẩm theo mùa, hiện đã ngừng nhận đơn hàng mới.',
      priceType: TradePostPriceType.FIXED,
      price: 35000,
      priceLabel: '35.000đ/hộp',
      address: 'Chợ Long Hoa, Tây Ninh',
      contactName: 'Trần Thị Tráng',
      contactPhone: '0902222222',
      status: TradePostStatus.ARCHIVED,
    },
  ];

  const tradePosts = [];
  for (const fixture of tradePostFixtures) {
    const { status, ...rest } = fixture;
    const post = await prisma.tradePost.upsert({
      where: { slug: fixture.slug },
      update: {},
      create: {
        ...rest,
        status,
        publishedAt: status === TradePostStatus.PUBLISHED ? new Date() : null,
        approvedById:
          status === TradePostStatus.PUBLISHED ? admin.id : undefined,
        approvedAt: status === TradePostStatus.PUBLISHED ? new Date() : null,
      },
    });
    tradePosts.push(post);
  }

  // ---------- Reviews (1-5 stars) on the two PUBLISHED posts ----------
  const publishedPosts = tradePosts.filter(
    (p) => p.status === TradePostStatus.PUBLISHED,
  );
  const ratings = [5, 4, 3, 5, 2];

  for (const post of publishedPosts) {
    for (const [index, rating] of ratings.entries()) {
      const reviewer = users[index % users.length];
      await prisma.tradeReview.upsert({
        where: { id: deterministicSeedId(post.slug, reviewer.id) },
        update: {},
        create: {
          id: deterministicSeedId(post.slug, reviewer.id),
          tradePostId: post.id,
          userId: reviewer.id,
          rating,
          content: `Đánh giá mẫu ${rating} sao cho sản phẩm này.`,
          status: TradeReviewStatus.PUBLISHED,
        },
      });
    }

    const publishedReviews = await prisma.tradeReview.findMany({
      where: {
        tradePostId: post.id,
        status: TradeReviewStatus.PUBLISHED,
        deletedAt: null,
      },
    });
    const total = publishedReviews.length;
    const average =
      total > 0
        ? Math.round(
            (publishedReviews.reduce((sum, r) => sum + r.rating, 0) / total) *
              10,
          ) / 10
        : 0;
    await prisma.tradePost.update({
      where: { id: post.id },
      data: { averageRating: average, reviewCount: total },
    });
  }

  console.log('Seed hoàn tất:');
  console.log(`  Admin: ${seedAdminEmail} / (mật khẩu từ SEED_ADMIN_PASSWORD)`);
  console.log(`  Moderator: moderator@localgo.local / Moderator@123456`);
  console.log(`  Business: ${business1.displayName}, ${business2.displayName}`);
  console.log(`  Users: ${users.map((u) => u.displayName).join(', ')}`);
  console.log(`  Trade posts: ${tradePosts.length}`);
  console.log(`  Temples: ${TEMPLE_SEED_DATA.length}`);
  console.log(`  Specialties: ${SPECIALTY_SEED_DATA.length}`);
  console.log(`  Historical sites: ${HISTORICAL_SITE_SEED_DATA.length}`);
  console.log(`  Agriculture items: ${AGRICULTURE_SEED_DATA.length}`);
  console.log(`  OCOP products: ${OCOP_SEED_DATA.length}`);
  console.log(`  Craft villages: ${CRAFT_VILLAGE_SEED_DATA.length}`);
  console.log(`  Cuisine items: ${CUISINE_SEED_DATA.length}`);
  console.log(`  Festivals: ${FESTIVAL_SEED_DATA.length}`);
  console.log(`  Experience tours: ${EXPERIENCE_TOUR_SEED_DATA.length}`);
  console.log(`  Feedback channels: ${FEEDBACK_CHANNEL_SEED_DATA.length}`);
  console.log(`  Map places: ${MAP_PLACE_SEED_DATA.length}`);
  console.log(`  Contacts: ${CONTACT_SEED_DATA.length}`);
  console.log(`  News articles: ${NEWS_SEED_DATA.length}`);
}

/** Stable, re-run-safe id derived from two known strings (not a security id). */
function deterministicSeedId(a: string, b: string): string {
  const seedNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const hash = createHash('sha1')
    .update(`${seedNamespace}:${a}:${b}`)
    .digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

main()
  .catch((error: unknown) => {
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
