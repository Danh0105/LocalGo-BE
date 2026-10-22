import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  CORS_ORIGINS: Joi.string().default(''),
  UPLOAD_DIR: Joi.string().default('uploads'),
  PUBLIC_BASE_URL: Joi.string().uri().required(),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  MAX_IMAGE_SIZE_MB: Joi.number().positive().default(5),

  BODY_LIMIT: Joi.string().default('1mb'),
  RATE_LIMIT_ENABLED: Joi.boolean().default(false),
  RATE_LIMIT_TTL: Joi.number().positive().default(60000),
  RATE_LIMIT_LIMIT: Joi.number().positive().default(200),
  MAX_CONCURRENT_REQUESTS: Joi.number().integer().min(1).max(1000).default(50),
  MAX_CONCURRENT_HEAVY_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(4),
  MAX_CONCURRENT_UPLOADS: Joi.number().integer().min(1).max(20).default(4),
  MAX_RSS_MB: Joi.number().integer().min(64).default(1024),
  MAX_EVENT_LOOP_DELAY_MS: Joi.number().integer().min(10).default(200),
  HTTP_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(60_000),
  HTTP_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(60_000),
  MAX_UPLOAD_TOTAL_MB: Joi.number().integer().min(1).max(256).default(64),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(100).default(3_000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(100).default(10_000),
  DB_LOCK_TIMEOUT_MS: Joi.number().integer().min(100).default(3_000),

  MAP_LOCATION_WORKER_ENABLED: Joi.boolean().default(false),
  MAP_LOCATION_WORKER_CONCURRENCY: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3),
  MAP_LOCATION_WORKER_POLL_MS: Joi.number().integer().min(1000).default(5000),
  MAP_LOCATION_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(3),

  OPENAI_API_KEY: Joi.string().min(1).optional(),
  OPENAI_MODEL: Joi.string().min(1).default('gpt-5-nano'),
  OPENAI_MAX_OUTPUT_TOKENS: Joi.number()
    .integer()
    .min(1)
    .max(4096)
    .default(800),

  // Optional dedicated salt for anonymous visitor hashing in trade analytics.
  // Falls back to JWT_ACCESS_SECRET when unset (see app.config.ts).
  TRADE_ANALYTICS_HASH_SECRET: Joi.string().min(16).optional(),

  MEDIA_STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),

  ZALO_AUTH_MODE: Joi.string().valid('mock', 'real').default('mock'),
  // Zalo Mini App "App Secret Key" — required to call Zalo's Graph API
  // (graph.zalo.me) for real access-token verification. Only meaningful
  // when ZALO_AUTH_MODE=real; irrelevant (and left unset) for mock/local dev.
  ZALO_APP_SECRET: Joi.string().min(1).when('ZALO_AUTH_MODE', {
    is: 'real',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Zalo OA push (trade post approval notifications). Optional everywhere —
  // the messaging service self-disables when ZALO_OA_ACCESS_TOKEN is unset,
  // so these can stay empty until real OA credentials are issued.
  ZALO_OA_ACCESS_TOKEN: Joi.string().min(1).optional(),
  ZALO_OA_API_BASE_URL: Joi.string().uri().default('https://openapi.zalo.me'),
  // Mini App id used to build the deep-link URL back into the app; the
  // notification is sent without a usable link if left unset.
  ZALO_MINI_APP_ID: Joi.string().min(1).optional(),
  ZALO_MINI_APP_DEEPLINK_PATH: Joi.string().min(1).default('trade-posts'),

  // tlds: { allow: false } — SEED_ADMIN_EMAIL intentionally uses a .local
  // dev-only domain (per spec's own .env.example), which isn't a real IANA
  // TLD; Joi's default email validator would otherwise reject it.
  SEED_ADMIN_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .default('admin@localgo.local'),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  PASSWORD_RESET_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/reset-password'),
  SMTP_HOST: Joi.string().min(1).optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().min(1).optional(),
  SMTP_PASSWORD: Joi.string().min(1).optional(),
  SMTP_FROM: Joi.string().min(3).default('LocalGo <no-reply@localgo.local>'),
});
