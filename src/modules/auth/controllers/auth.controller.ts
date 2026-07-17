import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UserService } from '../../users/services/user.service';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';
import { AuthTokensResponseDto } from '../dto/auth-tokens-response.dto';
import { PasswordLoginDto } from '../dto/password-login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ZaloLoginDto } from '../dto/zalo-login.dto';
import { AuthService, type RequestMeta } from '../services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập bằng Zalo Mini App access token' })
  @Post('zalo')
  loginWithZalo(
    @Body() dto: ZaloLoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.loginWithZalo(dto, this.extractMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Đăng nhập bằng email/mật khẩu (dành cho admin/moderator)',
  })
  @Post('login')
  loginWithPassword(
    @Body() dto: PasswordLoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.loginWithPassword(dto, this.extractMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto.refreshToken, this.extractMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất phiên hiện tại' })
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất tất cả thiết bị' })
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logoutAll(user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy thông tin người dùng hiện tại từ access token',
  })
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    const entity = await this.userService.getProfile(user.id);
    return UserResponseDto.fromEntity(entity);
  }

  private extractMeta(req: Request): RequestMeta {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
