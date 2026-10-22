import { type INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BusinessType, UserRole } from '../generated/prisma';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Password management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const marker = randomUUID();
  const userIds: string[] = [];

  async function createPasswordUser(params: {
    label: string;
    role?: UserRole;
    businessType?: BusinessType;
    password?: string;
  }) {
    const password = params.password ?? 'Current-password-123';
    const role = params.role ?? UserRole.BUSINESS;
    const user = await prisma.user.create({
      data: {
        displayName: params.label,
        email: `${marker}-${params.label}@example.com`,
        role,
        businessType:
          role === UserRole.BUSINESS
            ? (params.businessType ?? BusinessType.GARDEN)
            : null,
        passwordHash: await argon2.hash(password),
      },
    });
    userIds.push(user.id);
    return { user, password };
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    return response.body.data as {
      accessToken: string;
      refreshToken: string;
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  it('lets a garden owner change only their own password and revokes old access/refresh tokens', async () => {
    const { user, password } = await createPasswordUser({ label: 'garden' });
    const tokens = await login(user.email!, password);

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({
        currentPassword: password,
        newPassword: 'New-garden-password-456',
        newPasswordConfirmation: 'New-garden-password-456',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password })
      .expect(401);
    await login(user.email!, 'New-garden-password-456');

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2/);
    expect(stored.passwordHash).not.toContain('New-garden-password-456');
    expect(stored.credentialVersion).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { resourceId: user.id, action: 'USER_PASSWORD_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit)).not.toContain('New-garden-password-456');
  });

  it('rejects wrong current password, mismatched confirmation and non-garden accounts', async () => {
    const garden = await createPasswordUser({ label: 'validation-garden' });
    const gardenTokens = await login(garden.user.email!, garden.password);

    const wrong = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${gardenTokens.accessToken}`)
      .send({
        currentPassword: 'Wrong-password-123',
        newPassword: 'New-password-456',
        newPasswordConfirmation: 'New-password-456',
      })
      .expect(401);
    expect(wrong.body.error.code).toBe('CURRENT_PASSWORD_INVALID');

    const mismatch = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${gardenTokens.accessToken}`)
      .send({
        currentPassword: garden.password,
        newPassword: 'New-password-456',
        newPasswordConfirmation: 'Different-password-789',
      })
      .expect(400);
    expect(mismatch.body.error.code).toBe('PASSWORD_CONFIRMATION_MISMATCH');

    const weak = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${gardenTokens.accessToken}`)
      .send({
        currentPassword: garden.password,
        newPassword: 'onlyletters',
        newPasswordConfirmation: 'onlyletters',
      })
      .expect(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');

    const restaurant = await createPasswordUser({
      label: 'restaurant',
      businessType: BusinessType.RESTAURANT,
    });
    const restaurantTokens = await login(
      restaurant.user.email!,
      restaurant.password,
    );
    const forbidden = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${restaurantTokens.accessToken}`)
      .send({
        currentPassword: restaurant.password,
        newPassword: 'New-password-456',
        newPasswordConfirmation: 'New-password-456',
      })
      .expect(403);
    expect(forbidden.body.error.code).toBe('GARDEN_ACCOUNT_REQUIRED');
  });

  it('uses non-enumerating forgot responses and consumes reset tokens only once', async () => {
    const { user, password } = await createPasswordUser({ label: 'forgot' });
    const tokens = await login(user.email!, password);

    const existing = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    const missing = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${marker}-missing@example.com` })
      .expect(202);
    expect(existing.body.data.message).toBe(missing.body.data.message);

    const generated = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(generated.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const rawToken = `known-${randomUUID()}-${randomUUID()}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        newPassword: 'Reset-password-789',
        newPasswordConfirmation: 'Reset-password-789',
      })
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
    await login(user.email!, 'Reset-password-789');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        newPassword: 'Another-password-012',
        newPasswordConfirmation: 'Another-password-012',
      })
      .expect(400);
    expect(replay.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  it('allows Admin but never Moderator to reset another account password', async () => {
    const admin = await createPasswordUser({
      label: 'admin',
      role: UserRole.ADMIN,
      businessType: undefined,
    });
    const moderator = await createPasswordUser({
      label: 'moderator',
      role: UserRole.MODERATOR,
      businessType: undefined,
    });
    const target = await createPasswordUser({ label: 'admin-reset-target' });
    const adminTokens = await login(admin.user.email!, admin.password);
    const moderatorTokens = await login(
      moderator.user.email!,
      moderator.password,
    );
    const targetTokens = await login(target.user.email!, target.password);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.user.id}/password`)
      .set('Authorization', `Bearer ${moderatorTokens.accessToken}`)
      .send({ password: 'Admin-reset-password-123' })
      .expect(403);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.user.id}/password`)
      .set('Authorization', `Bearer ${adminTokens.accessToken}`)
      .send({ password: 'Admin-reset-password-123' })
      .expect(200);
    expect(response.body.data).not.toHaveProperty('password');
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('credentialVersion');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        resourceId: target.user.id,
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.oldData).toBeNull();
    expect(audit.newData).toBeNull();

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${targetTokens.accessToken}`)
      .expect(401);
    await login(target.user.email!, 'Admin-reset-password-123');
  });
});
