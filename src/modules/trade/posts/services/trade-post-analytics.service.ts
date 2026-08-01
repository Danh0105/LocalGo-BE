import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TradePostEventType } from '../../../../../generated/prisma';
import { assertCanManage } from '../../../../common/authorization/resource-ownership.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { PrismaService } from '../../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  ANALYTICS_DEFAULT_RANGE_DAYS,
  ANALYTICS_TOP_POSTS_LIMIT,
} from '../../trade.constants';
import { TradePostCategoryService } from '../../categories/services/trade-post-category.service';
import type {
  AnalyticsTimeseriesPointDto,
  AnalyticsTotalsDto,
  TradePostAnalyticsDetailDto,
  TradePostAnalyticsSummaryDto,
} from '../dto/trade-post-analytics-response.dto';
import type { QueryTradePostAnalyticsDto } from '../dto/query-trade-post-analytics.dto';
import {
  type AnalyticsRange,
  type AnalyticsScope,
  type DailyEventRow,
  type EventTypeCountRow,
  TradePostEventRepository,
} from '../repositories/trade-post-event.repository';
import { TradePostRepository } from '../repositories/trade-post.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TradePostAnalyticsService {
  constructor(
    private readonly eventRepository: TradePostEventRepository,
    private readonly tradePostRepository: TradePostRepository,
    private readonly categoryService: TradePostCategoryService,
    private readonly prisma: PrismaService,
  ) {}

  /** Business: aggregate analytics across all of the caller's own posts. */
  async getOwnerSummary(
    user: AuthenticatedUser,
    query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsSummaryDto> {
    return this.buildSummary({ ownerId: user.id }, this.resolveRange(query));
  }

  /** Admin: platform-wide analytics, optionally filtered by owner/category. */
  async getAdminSummary(
    query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsSummaryDto> {
    const scope: AnalyticsScope = {};
    if (query.ownerId) {
      scope.ownerId = query.ownerId;
    }
    if (query.category) {
      const category = await this.categoryService.findVisibleByCodeOrThrow(
        query.category,
        false,
      );
      scope.categoryId = category.id;
    }
    return this.buildSummary(scope, this.resolveRange(query));
  }

  /**
   * Per-post analytics. Shared by business (own post) and admin — authorization
   * is the reusable owner-or-elevated-role check.
   */
  async getPostAnalytics(
    user: AuthenticatedUser,
    id: string,
    query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsDetailDto> {
    const post = await this.tradePostRepository.findByIdForOwner(id);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    assertCanManage(user, post);

    const range = this.resolveRange(query);
    const scope: AnalyticsScope = { tradePostId: id };
    const [typeRows, uniqueVisitors, dailyRows] = await Promise.all([
      this.eventRepository.totalsByType(scope, range),
      this.eventRepository.uniqueVisitors(scope, range),
      this.eventRepository.dailyTimeseries(scope, range),
    ]);

    return {
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: post.status,
        viewCount: post.viewCount,
        saveCount: post.saveCount,
        reviewCount: post.reviewCount,
        averageRating: post.averageRating.toString(),
      },
      range,
      totals: this.mapTotals(typeRows, uniqueVisitors),
      timeseries: this.mapTimeseries(dailyRows),
    };
  }

  private async buildSummary(
    scope: AnalyticsScope,
    range: AnalyticsRange,
  ): Promise<TradePostAnalyticsSummaryDto> {
    const [typeRows, uniqueVisitors, dailyRows, topPosts, aggregate] =
      await Promise.all([
        this.eventRepository.totalsByType(scope, range),
        this.eventRepository.uniqueVisitors(scope, range),
        this.eventRepository.dailyTimeseries(scope, range),
        this.eventRepository.topPostsByViews(
          scope,
          range,
          ANALYTICS_TOP_POSTS_LIMIT,
        ),
        this.prisma.tradePost.aggregate({
          where: this.scopeToPostWhere(scope),
          _count: { _all: true },
          _sum: { reviewCount: true },
        }),
      ]);

    return {
      range,
      postCount: aggregate._count._all,
      totals: this.mapTotals(typeRows, uniqueVisitors),
      reviews: { count: aggregate._sum.reviewCount ?? 0 },
      topPosts,
      timeseries: this.mapTimeseries(dailyRows),
    };
  }

  private resolveRange(query: QueryTradePostAnalyticsDto): AnalyticsRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - ANALYTICS_DEFAULT_RANGE_DAYS * DAY_MS);
    return { from, to };
  }

  private mapTotals(
    rows: EventTypeCountRow[],
    uniqueVisitors: number,
  ): AnalyticsTotalsDto {
    const byType = new Map(rows.map((row) => [row.type, row.count]));
    return {
      views: byType.get(TradePostEventType.VIEW) ?? 0,
      uniqueVisitors,
      contactPhone: byType.get(TradePostEventType.CONTACT_PHONE) ?? 0,
      contactZalo: byType.get(TradePostEventType.CONTACT_ZALO) ?? 0,
      share: byType.get(TradePostEventType.SHARE) ?? 0,
      save: byType.get(TradePostEventType.SAVE) ?? 0,
    };
  }

  private mapTimeseries(rows: DailyEventRow[]): AnalyticsTimeseriesPointDto[] {
    const byDate = new Map<string, AnalyticsTimeseriesPointDto>();
    for (const row of rows) {
      let point = byDate.get(row.date);
      if (!point) {
        point = {
          date: row.date,
          views: 0,
          contactPhone: 0,
          contactZalo: 0,
          share: 0,
          save: 0,
        };
        byDate.set(row.date, point);
      }
      switch (row.type) {
        case TradePostEventType.VIEW:
          point.views += row.count;
          break;
        case TradePostEventType.CONTACT_PHONE:
          point.contactPhone += row.count;
          break;
        case TradePostEventType.CONTACT_ZALO:
          point.contactZalo += row.count;
          break;
        case TradePostEventType.SHARE:
          point.share += row.count;
          break;
        case TradePostEventType.SAVE:
          point.save += row.count;
          break;
      }
    }
    return [...byDate.values()];
  }

  private scopeToPostWhere(scope: AnalyticsScope): Prisma.TradePostWhereInput {
    return {
      deletedAt: null,
      ...(scope.tradePostId ? { id: scope.tradePostId } : {}),
      ...(scope.ownerId ? { ownerId: scope.ownerId } : {}),
      ...(scope.categoryId ? { categoryId: scope.categoryId } : {}),
    };
  }
}
