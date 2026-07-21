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

/**
 * Zalo's Graph API always includes `error`/`message` in the response body —
 * `error: 0` and `message: "Success"` on success — alongside the profile
 * fields, rather than reserving those keys for failure cases. Whether the
 * call succeeded must be determined by the presence of `id`, not by the
 * presence of the `error` key.
 */
interface ZaloGraphMeResponse {
  error?: number;
  message?: string;
  id?: string;
  name?: string;
  picture?: { data?: { url?: string } };
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
    url.searchParams.set('fields', 'id,name,picture');

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          access_token: accessToken,
          secret_key: this.appSecret,
        },
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

    let body: ZaloGraphMeResponse;
    try {
      body = (await response.json()) as ZaloGraphMeResponse;
    } catch {
      throw new AppException(
        ErrorCode.INTERNAL_ERROR,
        'Zalo trả về phản hồi không hợp lệ, vui lòng thử lại sau',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok || !body.id) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        body.message || 'Access token Zalo không hợp lệ hoặc đã hết hạn',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.name) {
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
