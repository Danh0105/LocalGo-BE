import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import ms from 'ms';
import type { UserRole } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { JwtConfig } from '../../../config/jwt.config';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  exp: number;
  iat: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    return this.jwtService.signAsync(payload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn as ms.StringValue,
    });
  }

  /**
   * The refresh JWT's `exp` claim is set to an explicit absolute timestamp
   * (not a relative TTL) so it always mirrors the owning AuthSession row's
   * absolute expiry — including across rotations, where the expiry must be
   * preserved rather than pushed forward. jsonwebtoken rejects passing both
   * `exp` in the payload and an `expiresIn` option, so only `exp` is set.
   */
  signRefreshToken(
    payload: { sub: string; sid: string },
    absoluteExpiresAt: Date,
  ): Promise<string> {
    const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    return this.jwtService.signAsync(
      { ...payload, exp: Math.floor(absoluteExpiresAt.getTime() / 1000) },
      { secret: jwtConfig.refreshSecret },
    );
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: jwtConfig.accessSecret,
    });
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Refresh token không hợp lệ hoặc đã hết hạn',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  getRefreshTtlMs(): number {
    const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
    return ms(jwtConfig.refreshExpiresIn as ms.StringValue);
  }
}
