import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginatedResultDto } from '../dto/pagination-meta.dto';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: unknown;
}

function isPaginatedResult(
  value: unknown,
): value is PaginatedResultDto<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as { data: unknown }).data)
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedResult(result)) {
          return {
            success: true as const,
            data: result.data as T,
            meta: result.meta,
          };
        }
        return { success: true as const, data: result };
      }),
    );
  }
}
