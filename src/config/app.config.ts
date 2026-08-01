import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  bodyLimit: string;
  swaggerEnabled: boolean;
  publicBaseUrl: string;
  rateLimitTtlMs: number;
  rateLimitLimit: number;
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
  rateLimitTtlMs: Number(process.env.RATE_LIMIT_TTL ?? 60000),
  rateLimitLimit: Number(process.env.RATE_LIMIT_LIMIT ?? 100),
  analyticsHashSecret:
    process.env.TRADE_ANALYTICS_HASH_SECRET ??
    process.env.JWT_ACCESS_SECRET ??
    'localgo-analytics-dev-secret',
}));
