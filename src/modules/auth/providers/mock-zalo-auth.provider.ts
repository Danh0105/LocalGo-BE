import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type {
  ZaloAuthProvider,
  ZaloProfile,
} from './zalo-auth-provider.interface';

/**
 * Development-only stand-in for real Zalo Mini App access-token verification.
 * Accepts tokens of the form `mock:<zaloId>:<displayName>` so integration
 * tests and local frontend dev can simulate any Zalo user deterministically
 * without calling out to Zalo. Only ever bound when ZALO_AUTH_MODE=mock.
 */
@Injectable()
export class MockZaloAuthProvider implements ZaloAuthProvider {
  verifyAccessToken(accessToken: string): Promise<ZaloProfile> {
    const parts = accessToken.split(':');
    if (parts[0] !== 'mock' || parts.length < 3 || !parts[1]) {
      return Promise.reject(
        new AppException(
          ErrorCode.INVALID_CREDENTIALS,
          'Access token Zalo (mock) không hợp lệ. Định dạng: mock:<zaloId>:<displayName>',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    }
    const [, zaloId, ...nameParts] = parts;
    return Promise.resolve({
      zaloId,
      name: decodeURIComponent(nameParts.join(':')),
    });
  }
}
