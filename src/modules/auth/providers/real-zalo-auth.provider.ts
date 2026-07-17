import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { AuthConfig } from '../../../config/auth.config';
import type {
  ZaloAuthProvider,
  ZaloProfile,
} from './zalo-auth-provider.interface';

const ZALO_GRAPH_ME_URL = 'https://graph.zalo.me/v2.0/me';

interface ZaloGraphMeSuccess {
  id: string;
  name: string;
  picture?: { data?: { url?: string } };
}

interface ZaloGraphMeError {
  error: number;
  message: string;
}

/**
 * Production Zalo Mini App access-token verification. Calls Zalo's Graph API
 * with the App Secret Key so Zalo confirms the token was actually issued to
 * this Mini App, then maps the response into the same ZaloProfile shape
 * MockZaloAuthProvider returns — AuthService never needs to know which mode
 * is active.
 */
@Injectable()
export class RealZaloAuthProvider implements ZaloAuthProvider {
  private readonly logger = new Logger(RealZaloAuthProvider.name);
  private readonly appSecret: string;

  constructor(configService: ConfigService) {
    const authConfig = configService.getOrThrow<AuthConfig>('auth');
    this.appSecret = authConfig.zaloAppSecret ?? '';
  }

  async verifyAccessToken(accessToken: string): Promise<ZaloProfile> {
    if (!accessToken.trim()) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Access token Zalo không hợp lệ',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const url = new URL(ZALO_GRAPH_ME_URL);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,name,picture');

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { secret_key: this.appSecret },
      });
    } catch (error) {
      this.logger.error(
        'Không thể kết nối tới Zalo Graph API',
        error instanceof Error ? error.stack : undefined,
      );
      throw new AppException(
        ErrorCode.INTERNAL_ERROR,
        'Không thể xác thực với Zalo, vui lòng thử lại sau',
        HttpStatus.BAD_GATEWAY,
      );
    }

    let body: ZaloGraphMeSuccess | ZaloGraphMeError;
    try {
      body = (await response.json()) as ZaloGraphMeSuccess | ZaloGraphMeError;
    } catch {
      throw new AppException(
        ErrorCode.INTERNAL_ERROR,
        'Zalo trả về phản hồi không hợp lệ, vui lòng thử lại sau',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok || 'error' in body) {
      const message =
        'error' in body
          ? body.message
          : 'Access token Zalo không hợp lệ hoặc đã hết hạn';
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        message,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.id || !body.name) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Zalo không trả về đủ thông tin người dùng',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      zaloId: body.id,
      name: body.name,
      avatarUrl: body.picture?.data?.url,
    };
  }
}
