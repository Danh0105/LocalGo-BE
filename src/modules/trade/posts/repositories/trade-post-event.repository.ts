import { Injectable } from '@nestjs/common';
import { Prisma, TradePostEventType } from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';

/**
 * Local timezone used to bucket the daily analytics time-series. Stored
 * timestamps are UTC (Prisma `DateTime` -> `timestamp without time zone`), so
 * we reinterpret them as UTC then convert to this zone before truncating to a
 * day — otherwise a view at 23:30 VN time would land on the wrong calendar day.
 */
const ANALYTICS_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Scope of an analytics query: a single post, an owner, and/or a category. */
export interface AnalyticsScope {
  tradePostId?: string;
  ownerId?: string;
  categoryId?: string;
}

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

export interface EventTypeCountRow {
  type: TradePostEventType;
  count: number;
}

export interface DailyEventRow {
  date: string;
  type: TradePostEventType;
  count: number;
}

export interface TopPostRow {
  tradePostId: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  views: number;
}

@Injectable()
export class TradePostEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  record(
    data: {
      tradePostId: string;
      type: TradePostEventType;
      userId?: string | null;
      visitorHash?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const client = tx ?? this.prisma;
    return client.tradePostEvent.create({
      data: {
        tradePostId: data.tradePostId,
        type: data.type,
        userId: data.userId ?? null,
        visitorHash: data.visitorHash ?? null,
      },
      select: { id: true },
    });
  }

  /** Total event count grouped by type, within scope + range. */
  async totalsByType(
    scope: AnalyticsScope,
    range: AnalyticsRange,
  ): Promise<EventTypeCountRow[]> {
    return this.prisma.$queryRaw<EventTypeCountRow[]>`
      SELECT e."type" AS "type", COUNT(*)::int AS "count"
      FROM "TradePostEvent" e
      JOIN "TradePost" p ON p."id" = e."tradePostId"
      WHERE ${this.buildWhere(scope, range)}
      GROUP BY e."type"`;
  }

  /**
   * Approximate unique visitors among VIEW events: distinct logged-in userId,
   * falling back to the anonymous visitorHash. Rows with neither are ignored
   * by COUNT(DISTINCT ...) on NULL.
   */
  async uniqueVisitors(
    scope: AnalyticsScope,
    range: AnalyticsRange,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT COALESCE(e."userId", e."visitorHash"))::int AS "count"
      FROM "TradePostEvent" e
      JOIN "TradePost" p ON p."id" = e."tradePostId"
      WHERE ${this.buildWhere(scope, range)}
        AND e."type" = ${TradePostEventType.VIEW}::"TradePostEventType"`;
    return rows[0]?.count ?? 0;
  }

  /** Per-day counts split by event type, ordered chronologically (VN time). */
  async dailyTimeseries(
    scope: AnalyticsScope,
    range: AnalyticsRange,
  ): Promise<DailyEventRow[]> {
    return this.prisma.$queryRaw<DailyEventRow[]>`
      SELECT to_char(
               date_trunc(
                 'day',
                 (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ANALYTICS_TIMEZONE}
               ),
               'YYYY-MM-DD'
             ) AS "date",
             e."type" AS "type",
             COUNT(*)::int AS "count"
      FROM "TradePostEvent" e
      JOIN "TradePost" p ON p."id" = e."tradePostId"
      WHERE ${this.buildWhere(scope, range)}
      GROUP BY 1, e."type"
      ORDER BY 1 ASC`;
  }

  /** Posts with the most views in range, most-viewed first. */
  async topPostsByViews(
    scope: AnalyticsScope,
    range: AnalyticsRange,
    limit: number,
  ): Promise<TopPostRow[]> {
    return this.prisma.$queryRaw<TopPostRow[]>`
      SELECT e."tradePostId" AS "tradePostId",
             p."title" AS "title",
             p."slug" AS "slug",
             p."thumbnailUrl" AS "thumbnailUrl",
             COUNT(*)::int AS "views"
      FROM "TradePostEvent" e
      JOIN "TradePost" p ON p."id" = e."tradePostId"
      WHERE ${this.buildWhere(scope, range)}
        AND e."type" = ${TradePostEventType.VIEW}::"TradePostEventType"
      GROUP BY e."tradePostId", p."title", p."slug", p."thumbnailUrl"
      ORDER BY "views" DESC
      LIMIT ${limit}`;
  }

  private buildWhere(scope: AnalyticsScope, range: AnalyticsRange): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`e."createdAt" >= ${range.from}`,
      Prisma.sql`e."createdAt" < ${range.to}`,
      Prisma.sql`p."deletedAt" IS NULL`,
    ];
    if (scope.tradePostId) {
      conditions.push(Prisma.sql`e."tradePostId" = ${scope.tradePostId}`);
    }
    if (scope.ownerId) {
      conditions.push(Prisma.sql`p."ownerId" = ${scope.ownerId}`);
    }
    if (scope.categoryId) {
      conditions.push(Prisma.sql`p."categoryId" = ${scope.categoryId}`);
    }
    return Prisma.join(conditions, ' AND ');
  }
}
