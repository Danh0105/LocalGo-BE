import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    // Public routes stay open, but a valid Bearer token still identifies the
    // viewer (e.g. "isSaved" on posts, attributing views). A missing, invalid
    // or blocked token just means an anonymous request — never a 401.
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization) {
      try {
        await super.canActivate(context);
      } catch {
        request.user = undefined;
      }
    }
    return true;
  }
}
