import {
  PaginatedResultDto,
  PaginationMetaDto,
} from '../dto/pagination-meta.dto';

export interface PrismaPaginationArgs {
  skip: number;
  take: number;
}

export function buildPaginationArgs(
  page: number,
  limit: number,
): PrismaPaginationArgs {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginate<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResultDto<T> {
  return new PaginatedResultDto(
    data,
    new PaginationMetaDto(page, limit, total),
  );
}
