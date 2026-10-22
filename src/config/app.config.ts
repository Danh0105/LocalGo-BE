import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  bodyLimit: string;
  swaggerEnabled: boolean;
  publicBaseUrl: string;
  rateLimitEnabled: boolean;
  rateLimitTtlMs: number;
  rateLimitLimit: number;
  maxConcurrentRequests: number;
  maxConcurrentHeavyRequests: number;
  maxConcurrentUploads: number;
  maxRssMb: number;
  maxEventLoopDelayMs: number;
  httpRequestTimeoutMs: number;
  httpIdleTimeoutMs: number;
  // Server-side salt for hashing (ip + userAgent) into an anonymous visitor
  // fingerprint used by trade-post analytics. Never persist the raw IP.
  analyticsHashSecret: string;
}

export default registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  bodyLimit: process.env.BODY_LIMIT ?? '1mb',
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001',
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  rateLimitTtlMs: Number(process.env.RATE_LIMIT_TTL ?? 60000),
  rateLimitLimit: Number(process.env.RATE_LIMIT_LIMIT ?? 200),
  maxConcurrentRequests: Number(process.env.MAX_CONCURRENT_REQUESTS ?? 50),
  maxConcurrentHeavyRequests: Number(
    process.env.MAX_CONCURRENT_HEAVY_REQUESTS ?? 4,
  ),
  maxConcurrentUploads: Number(process.env.MAX_CONCURRENT_UPLOADS ?? 4),
  maxRssMb: Number(process.env.MAX_RSS_MB ?? 1024),
  maxEventLoopDelayMs: Number(process.env.MAX_EVENT_LOOP_DELAY_MS ?? 200),
  httpRequestTimeoutMs: Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 60_000),
  httpIdleTimeoutMs: Number(process.env.HTTP_IDLE_TIMEOUT_MS ?? 60_000),
  analyticsHashSecret:
    process.env.TRADE_ANALYTICS_HASH_SECRET ??
    process.env.JWT_ACCESS_SECRET ??
    'localgo-analytics-dev-secret',
}));
