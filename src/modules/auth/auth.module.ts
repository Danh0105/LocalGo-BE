import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthConfig } from '../../config/auth.config';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { MockZaloAuthProvider } from './providers/mock-zalo-auth.provider';
import { ZALO_AUTH_PROVIDER } from './providers/zalo-auth.token';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    UsersModule,
    SessionsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAccessStrategy,
    {
      provide: ZALO_AUTH_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const authConfig = configService.getOrThrow<AuthConfig>('auth');
        if (authConfig.zaloAuthMode === 'mock') {
          return new MockZaloAuthProvider();
        }
        throw new Error('ZALO_AUTH_MODE=real chưa được triển khai ở Phase 1');
      },
      inject: [ConfigService],
    },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
