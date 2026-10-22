import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma';
import { paginate } from '../../../common/pagination/pagination.util';
import {
  expandSearchQuery,
  normalizeSearchText,
} from '../../../common/utils/search-query.util';
import { PrismaService } from '../../../database/prisma.service';
import type { QuerySearchDto } from '../dto/query-search.dto';
import type { SearchResultDto } from '../dto/search-response.dto';
import {
  SEARCH_RESOURCE_TYPES,
  type SearchResourceType,
} from '../search.constants';

type SearchVisibility = 'public' | 'admin';

interface SearchRow {
  resourceType: SearchResourceType | null;
  resourceLabel: string | null;
  id: string | null;
  slug: string | null;
  title: string | null;
  summary: string | null;
  category: string | null;
  imageUrl: string | null;
  status: string | null;
  updatedAt: Date | null;
  total: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  publicSearch(query: QuerySearchDto) {
    return this.search(query, 'public');
  }

  adminSearch(query: QuerySearchDto) {
    return this.search(query, 'admin');
  }

  private async search(query: QuerySearchDto, visibility: SearchVisibility) {
    const requestedTypes = query.types?.length
      ? [...new Set(query.types)]
      : [...SEARCH_RESOURCE_TYPES];
    const offset = (query.page - 1) * query.limit;
    const searchVariants = expandSearchQuery(query.q);
    const audienceFilter =
      visibility === 'public'
        ? Prisma.sql`document.audience IN ('BOTH', 'PUBLIC') AND document.is_public`
        : Prisma.sql`document.audience IN ('BOTH', 'ADMIN')`;

    const rows = await this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH input_query AS (
        SELECT
          localgo_normalize_search_text(${query.q}) AS normalized_query
      ),
      search_queries AS (
        SELECT
          localgo_normalize_search_text(search_term) AS normalized_query,
          localgo_prefix_tsquery(search_term) AS ts_query,
          ordinality
        FROM unnest(
          ARRAY[${Prisma.join(searchVariants)}]::text[]
        ) WITH ORDINALITY AS variants(search_term, ordinality)
      ),
      searchable_documents AS (
        SELECT
          document.*,
          document.search_vector || setweight(
            to_tsvector(
              'simple',
              localgo_normalize_search_text(document.resource_label)
            ),
            'C'
          ) AS augmented_search_vector
        FROM "GlobalSearchDocument" document
      ),
      matches AS (
        SELECT
          document.resource_type AS "resourceType",
          document.resource_label AS "resourceLabel",
          document.id,
          document.slug,
          document.title,
          document.summary,
          document.category,
          document.image_url AS "imageUrl",
          document.status,
          document.updated_at AS "updatedAt",
          (
            CASE
              WHEN document.normalized_title = search_query.normalized_query THEN 1000
              WHEN document.normalized_title LIKE search_query.normalized_query || '%' THEN 700
              WHEN document.normalized_title LIKE '%' || search_query.normalized_query || '%' THEN 500
              ELSE 0
            END
            + CASE
                WHEN localgo_normalize_search_text(document.id)
                  LIKE '%' || search_query.normalized_query || '%' THEN 250
                ELSE 0
              END
            + COALESCE((
                SELECT max(
                  ts_rank_cd(
                    document.augmented_search_vector,
                    variant.ts_query,
                    32
                  ) * 200 * CASE WHEN variant.ordinality = 1 THEN 1 ELSE 0.85 END
                )
                FROM search_queries variant
                WHERE document.augmented_search_vector @@ variant.ts_query
              ), 0)
            + COALESCE((
                SELECT max(
                  similarity(
                    document.normalized_title,
                    variant.normalized_query
                  ) * 100 * CASE WHEN variant.ordinality = 1 THEN 1 ELSE 0.85 END
                )
                FROM search_queries variant
              ), 0)
          ) AS score
        FROM searchable_documents document
        CROSS JOIN input_query search_query
        WHERE document.resource_type IN (${Prisma.join(requestedTypes)})
          AND ${audienceFilter}
          AND (
            EXISTS (
              SELECT 1
              FROM search_queries variant
              WHERE document.augmented_search_vector @@ variant.ts_query
            )
            OR EXISTS (
              SELECT 1
              FROM search_queries variant
              WHERE document.normalized_title % variant.normalized_query
                AND localgo_all_terms_fuzzy_match(
                  variant.normalized_query,
                  document.normalized_title
                )
              )
          )
      ),
      counted AS (
        SELECT count(*)::integer AS total FROM matches
      ),
      page AS (
        SELECT *
        FROM matches
        ORDER BY score DESC, "updatedAt" DESC, title ASC
        OFFSET ${offset}
        LIMIT ${query.limit}
      )
      SELECT
        page."resourceType",
        page."resourceLabel",
        page.id,
        page.slug,
        page.title,
        page.summary,
        page.category,
        page."imageUrl",
        page.status,
        page."updatedAt",
        counted.total
      FROM counted
      LEFT JOIN page ON true
      ORDER BY page.score DESC, page."updatedAt" DESC, page.title ASC
    `);

    const total = rows[0]?.total ?? 0;
    const data = rows
      .filter((row): row is SearchRow & { id: string } => row.id !== null)
      .map((row) => this.toResponse(row));

    return paginate(data, query.page, query.limit, total);
  }

  private toResponse(row: SearchRow & { id: string }): SearchResultDto {
    return {
      resourceType: row.resourceType as SearchResourceType,
      resourceLabel: row.resourceLabel as string,
      id: row.id,
      slug: row.slug,
      title: row.title as string,
      summary: row.summary as string,
      category: row.category,
      imageUrl: row.imageUrl,
      status: row.status as string,
      updatedAt: row.updatedAt as Date,
    };
  }
}

export { normalizeSearchText };
