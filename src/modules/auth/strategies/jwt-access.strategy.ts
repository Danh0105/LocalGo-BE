import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../../../../generated/prisma';
import type { JwtConfig } from '../../../config/jwt.config';
import { UserService } from '../../users/services/user.service';
import type { AccessTokenPayload } from '../services/token.service';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const jwtConfig = configService.getOrThrow<JwtConfig>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.userService
      .getProfile(payload.sub)
      .catch(() => null);
    if (!user || user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
