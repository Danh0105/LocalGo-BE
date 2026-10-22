import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { finalize, type Observable } from 'rxjs';
import { OverloadProtection } from './overload-protection';

export class OverloadInterceptor implements NestInterceptor {
  constructor(private readonly protection: OverloadProtection) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const complete = this.protection.trackProcessing(
      context.switchToHttp().getRequest<Request>(),
    );
    return next.handle().pipe(finalize(complete));
  }
}
