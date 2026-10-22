import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  connectionTimeoutMs: number;
  statementTimeoutMs: number;
  lockTimeoutMs: number;
}

export default registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL ?? '',
  poolMax: Number(process.env.DB_POOL_MAX ?? 10),
  connectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 3_000),
  statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 10_000),
  lockTimeoutMs: Number(process.env.DB_LOCK_TIMEOUT_MS ?? 3_000),
}));
