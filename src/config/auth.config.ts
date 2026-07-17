import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  zaloAuthMode: 'mock' | 'real';
  seedAdminEmail: string;
  seedAdminPassword: string | undefined;
}

export default registerAs('auth', (): AuthConfig => ({
  zaloAuthMode: (process.env.ZALO_AUTH_MODE as 'mock' | 'real') ?? 'mock',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@localgo.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
}));
