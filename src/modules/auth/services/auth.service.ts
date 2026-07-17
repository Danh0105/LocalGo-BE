import { HttpStatus, Injectable, Inject } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { UserStatus } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { UserEntity } from '../../users/entities/user.entity';
import { UserService } from '../../users/services/user.service';
import { SessionService } from '../../sessions/services/session.service';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { AuthTokensResponseDto } from '../dto/auth-tokens-response.dto';
import { PasswordLoginDto } from '../dto/password-login.dto';
import { ZaloLoginDto } from '../dto/zalo-login.dto';
import type { ZaloAuthProvider } from '../providers/zalo-auth-provider.interface';
import { ZALO_AUTH_PROVIDER } from '../providers/zalo-auth.token';
import { TokenService } from './token.service';

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly auditLogService: AuditLogService,
    @Inject(ZALO_AUTH_PROVIDER)
    private readonly zaloAuthProvider: ZaloAuthProvider,
  ) {}

  async loginWithZalo(
    dto: ZaloLoginDto,
    meta: RequestMeta,
  ): Promise<AuthTokensResponseDto> {
    const profile = await this.zaloAuthProvider.verifyAccessToken(
      dto.accessToken,
    );
    const user = await this.userService.findOrCreateByZaloProfile({
      zaloId: profile.zaloId,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    this.assertActive(user);
    const tokens = await this.issueTokens(user, meta);
    await this.auditLogService.write({
      actorId: user.id,
      action: 'AUTH_LOGIN_ZALO',
      resourceType: 'User',
      resourceId: user.id,
    });
    return tokens;
  }

  async loginWithPassword(
    dto: PasswordLoginDto,
    meta: RequestMeta,
  ): Promise<AuthTokensResponseDto> {
    const record = await this.userService.findByEmailForAuth(dto.email);
    if (!record?.passwordHash) {
      throw this.invalidCredentials();
    }
    const passwordMatches = await argon2
      .verify(record.passwordHash, dto.password)
      .catch(() => false);
    if (!passwordMatches) {
      throw this.invalidCredentials();
    }
    const user = new UserEntity(record);
    this.assertActive(user);
    const tokens = await this.issueTokens(user, meta);
    await this.auditLogService.write({
      actorId: user.id,
      action: 'AUTH_LOGIN_PASSWORD',
      resourceType: 'User',
      resourceId: user.id,
    });
    return tokens;
  }

  async refresh(
    refreshToken: string,
    meta: RequestMeta,
  ): Promise<AuthTokensResponseDto> {
    const decoded = await this.tokenService.verifyRefreshToken(refreshToken);
    const newSessionId = randomUUID();
    const newRefreshToken = await this.tokenService.signRefreshToken(
      { sub: decoded.sub, sid: newSessionId },
      new Date(decoded.exp * 1000),
    );

    const rotated = await this.sessionService.rotate({
      sessionId: decoded.sid,
      presentedToken: refreshToken,
      newSessionId,
      newRefreshToken,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const user = await this.userService.getProfile(rotated.userId);
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: rotated.expiresAt,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const decoded = await this.tokenService
      .verifyRefreshToken(refreshToken)
      .catch(() => null);
    if (!decoded) {
      return;
    }
    await this.sessionService.revoke(decoded.sid);
    await this.auditLogService.write({
      actorId: decoded.sub,
      action: 'AUTH_LOGOUT',
      resourceType: 'AuthSession',
      resourceId: decoded.sid,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllForUser(userId);
    await this.auditLogService.write({
      actorId: userId,
      action: 'AUTH_LOGOUT_ALL',
      resourceType: 'User',
      resourceId: userId,
    });
  }

  private async issueTokens(
    user: UserEntity,
    meta: RequestMeta,
  ): Promise<AuthTokensResponseDto> {
    const sessionId = randomUUID();
    const ttlMs = this.tokenService.getRefreshTtlMs();
    const expiresAt = new Date(Date.now() + ttlMs);

    const refreshToken = await this.tokenService.signRefreshToken(
      { sub: user.id, sid: sessionId },
      expiresAt,
    );

    await this.sessionService.createFamily({
      id: sessionId,
      userId: user.id,
      refreshToken,
      ttlMs,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.userService.touchLastLogin(user.id);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
    });

    return { accessToken, refreshToken, expiresAt };
  }

  private assertActive(user: UserEntity): void {
    if (user.status === UserStatus.BLOCKED) {
      throw new AppException(
        ErrorCode.ACCOUNT_BLOCKED,
        'Tài khoản đã bị khóa',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private invalidCredentials(): AppException {
    return new AppException(
      ErrorCode.INVALID_CREDENTIALS,
      'Email hoặc mật khẩu không đúng',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
