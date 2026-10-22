import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  zaloAuthMode: 'mock' | 'real';
  zaloAppSecret: string | undefined;
  seedAdminEmail: string;
  seedAdminPassword: string | undefined;
  passwordResetTtlMinutes: number;
  passwordResetUrl: string;
  smtpHost: string | undefined;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPassword: string | undefined;
  smtpFrom: string;
}

export default registerAs('auth', (): AuthConfig => ({
  zaloAuthMode: (process.env.ZALO_AUTH_MODE as 'mock' | 'real') ?? 'mock',
  zaloAppSecret: process.env.ZALO_APP_SECRET,
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@localgo.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 15),
  passwordResetUrl:
    process.env.PASSWORD_RESET_URL ?? 'http://localhost:3000/reset-password',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM ?? 'LocalGo <no-reply@localgo.local>',
}));
