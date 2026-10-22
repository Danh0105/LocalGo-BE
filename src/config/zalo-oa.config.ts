import { registerAs } from '@nestjs/config';

export interface ZaloOaConfig {
  enabled: boolean;
  accessToken: string | undefined;
  apiBaseUrl: string;
  miniAppId: string | undefined;
  miniAppDeepLinkPath: string;
}

export default registerAs('zaloOa', (): ZaloOaConfig => ({
  // Sending is opt-in: stays off until ZALO_OA_ACCESS_TOKEN is actually
  // configured, so environments without OA credentials yet (this feature
  // ships before the credentials do) never attempt the call.
  enabled: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
  accessToken: process.env.ZALO_OA_ACCESS_TOKEN,
  apiBaseUrl: process.env.ZALO_OA_API_BASE_URL ?? 'https://openapi.zalo.me',
  miniAppId: process.env.ZALO_MINI_APP_ID,
  miniAppDeepLinkPath: process.env.ZALO_MINI_APP_DEEPLINK_PATH ?? 'trade-posts',
}));
