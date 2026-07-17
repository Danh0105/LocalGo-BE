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
  RATE_LIMIT_TTL: Joi.number().positive().default(60000),
  RATE_LIMIT_LIMIT: Joi.number().positive().default(100),

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
});
