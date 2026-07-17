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
}));
