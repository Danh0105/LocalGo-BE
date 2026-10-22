import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { LookupAddress } from 'node:dns';

import { isValidGoogleMapsUrl } from '../../common/validation/google-maps-url.validator';
import { extractDestinationCoordinates } from './google-maps-coordinate.util';

const MAX_REDIRECTS = 5;
const PER_REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 10_000;
const DNS_TIMEOUT_MS = 3_000;

export class TemporaryMapResolutionError extends Error {
  constructor(public readonly reasonCode: string) {
    super(reasonCode);
    this.name = 'TemporaryMapResolutionError';
  }
}
export class UnsafeMapRedirectError extends Error {
  constructor(public readonly reasonCode: string) {
    super(reasonCode);
    this.name = 'UnsafeMapRedirectError';
  }
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIp(address: string): boolean {
  const family = isIP(address);

  if (family === 4) {
    return isBlockedIpv4(address);
  }

  if (family !== 6) {
    return true;
  }

  const normalized = address.toLowerCase();

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mapped) {
    return isBlockedIpv4(mapped[1]);
  }

  const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);

  return (
    firstHextet < 0x2000 ||
    firstHextet > 0x3fff ||
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

@Injectable()
export class SafeGoogleRedirectService {
  async follow(input: URL): Promise<URL> {
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    let current = input;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      this.assertAllowed(current);

      // Không cần request nếu URL đã có tọa độ.
      if (extractDestinationCoordinates(current)) {
        return current;
      }

      const response = await this.requestHeaders(current, deadline);

      if (response.statusCode === 429 || response.statusCode >= 500) {
        throw new TemporaryMapResolutionError(`HTTP_${response.statusCode}`);
      }

      // Chỉ xử lý redirect 3xx.
      if (response.statusCode < 300 || response.statusCode >= 400) {
        return current;
      }

      if (!response.location) {
        throw new UnsafeMapRedirectError('REDIRECT_WITHOUT_LOCATION');
      }

      if (hop === MAX_REDIRECTS) {
        throw new UnsafeMapRedirectError('TOO_MANY_REDIRECTS');
      }

      let next: URL;

      try {
        next = new URL(response.location, current);
      } catch {
        throw new UnsafeMapRedirectError('INVALID_REDIRECT_LOCATION');
      }

      // Kiểm tra hostname và URL tại mỗi redirect.
      this.assertAllowed(next);

      if (extractDestinationCoordinates(next)) {
        return next;
      }

      current = next;
    }

    throw new UnsafeMapRedirectError('TOO_MANY_REDIRECTS');
  }

  private assertAllowed(url: URL): void {
    if (!isValidGoogleMapsUrl(url.href)) {
      throw new UnsafeMapRedirectError('REDIRECT_NOT_ALLOWED');
    }
  }

  private async resolveAddresses(
    hostname: string,
    deadline: number,
  ): Promise<LookupAddress[]> {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new TemporaryMapResolutionError('TOTAL_TIMEOUT');
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const addresses = await Promise.race([
        lookup(hostname, {
          all: true,
          order: 'ipv4first',
        }),

        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new TemporaryMapResolutionError('DNS_TIMEOUT')),
            Math.min(DNS_TIMEOUT_MS, remaining),
          );
        }),
      ]);

      if (addresses.length === 0) {
        throw new TemporaryMapResolutionError('DNS_EMPTY');
      }

      return addresses;
    } catch (error) {
      if (error instanceof TemporaryMapResolutionError) {
        throw error;
      }

      const dnsError = error as NodeJS.ErrnoException;

      console.error('[Google Maps DNS] Resolution failed', {
        hostname,
        code: dnsError.code,
        message: dnsError.message,
      });

      throw new TemporaryMapResolutionError('DNS_ERROR');
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async requestHeaders(
    url: URL,
    deadline: number,
  ): Promise<{ statusCode: number; location?: string }> {
    this.assertAllowed(url);

    const addresses = await this.resolveAddresses(url.hostname, deadline);

    // Giữ chính sách SSRF: từ chối nếu có bất kỳ
    // địa chỉ DNS không được phép.
    const safe = addresses.filter(({ address }) => !isBlockedIp(address));

    if (safe.length === 0 || safe.length !== addresses.length) {
      throw new UnsafeMapRedirectError('DNS_ADDRESS_NOT_ALLOWED');
    }

    // VPS hiện tại hoạt động với IPv4.
    // Chỉ dùng IPv6 khi DNS không trả về IPv4.
    const selected = safe.find(({ family }) => family === 4) ?? safe[0];

    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new TemporaryMapResolutionError('TOTAL_TIMEOUT');
    }

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();

      const timeout = setTimeout(
        () => abortController.abort(),
        Math.min(PER_REQUEST_TIMEOUT_MS, remaining),
      );

      const req = request(
        url,
        {
          method: 'GET',

          headers: {
            Accept: 'text/html;q=0.1,*/*;q=0.01',
            'User-Agent': 'LocalGo-MapResolver/1.0',
          },

          signal: abortController.signal,

          // Giữ hostname gốc cho TLS/SNI.
          servername: url.hostname,

          // Pin request vào IP đã được kiểm tra.
          // Tránh DNS rebinding giữa kiểm tra và kết nối.
          lookup: (_hostname, options, callback) => {
            if (options.all) {
              callback(null, [selected]);
              return;
            }

            callback(null, selected.address, selected.family);
          },
        },
        (response) => {
          clearTimeout(timeout);

          const statusCode = response.statusCode ?? 0;
          const rawLocation = response.headers.location;

          const location =
            typeof rawLocation === 'string' ? rawLocation : undefined;

          // Không tải phần body của trang Google Maps.
          response.destroy();

          resolve({
            statusCode,
            ...(location ? { location } : {}),
          });
        },
      );

      req.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timeout);

        console.error('[Google Maps Redirect] Network request failed', {
          hostname: url.hostname,
          ip: selected.address,
          family: selected.family,
          code: error.code,
          name: error.name,
          message: error.message,
          errno: error.errno,
          syscall: error.syscall,
        });

        if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
          reject(new TemporaryMapResolutionError('REQUEST_TIMEOUT'));
          return;
        }

        reject(new TemporaryMapResolutionError('NETWORK_ERROR'));
      });

      req.end();
    });
  }
}
