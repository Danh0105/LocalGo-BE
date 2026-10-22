import { UserRole, UserStatus, type User } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { UserAdminService } from './user-admin.service';

const baseUser: User = {
  id: 'target',
  zaloId: null,
  phone: null,
  email: 'target@example.com',
  displayName: 'Target',
  avatarUrl: null,
  passwordHash: null,
  credentialVersion: 0,
  role: UserRole.USER,
  businessType: null,
  status: UserStatus.ACTIVE,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('UserAdminService', () => {
  const repository = {
    findAdminList: jest.fn(),
    findById: jest.fn(),
    updateStatusAndRevokeSessions: jest.fn(),
    emailExists: jest.fn(),
    phoneExists: jest.fn(),
    createUserWithAudit: jest.fn(),
    getDeletionCounts: jest.fn(),
    deleteAccountAndRelatedData: jest.fn(),
    hardDeleteMedia: jest.fn(),
  };
  const mediaService = { purgeStorage: jest.fn() };
  const service = new UserAdminService(
    repository as never,
    mediaService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates an active non-admin account with the requested role and a hashed password', async () => {
    let capturedPasswordHash = '';
    repository.emailExists.mockResolvedValue(false);
    repository.phoneExists.mockResolvedValue(false);
    repository.createUserWithAudit.mockImplementation(
      (input: { passwordHash: string; role: UserRole }) => {
        capturedPasswordHash = input.passwordHash;
        return Promise.resolve({
          ...baseUser,
          id: 'business-id',
          email: 'business@example.com',
          phone: '0901234567',
          displayName: 'Business Name',
          passwordHash: input.passwordHash,
          role: input.role,
        });
      },
    );
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };

    const result = await service.createUser(actor, {
      displayName: ' Business Name ',
      email: 'BUSINESS@EXAMPLE.COM',
      phone: '0901234567',
      password: 'business-password-123',
      role: UserRole.MODERATOR,
    });

    expect(result.role).toBe(UserRole.MODERATOR);
    expect(repository.createUserWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        displayName: 'Business Name',
        email: 'business@example.com',
        phone: '0901234567',
        role: UserRole.MODERATOR,
      }),
    );
    expect(capturedPasswordHash).toMatch(/^\$argon2/);
    expect(capturedPasswordHash).not.toContain('business-password-123');
  });

  it('rejects a duplicate email before creating an account', async () => {
    repository.emailExists.mockResolvedValue(true);
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };

    await expect(
      service.createUser(actor, {
        displayName: 'Business Name',
        email: 'business@example.com',
        password: 'business-password-123',
        role: UserRole.BUSINESS,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_ALREADY_EXISTS });
    expect(repository.createUserWithAudit).not.toHaveBeenCalled();
  });

  it('does not allow an admin account to be created', async () => {
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };

    await expect(
      service.createUser(actor, {
        displayName: 'Another Admin',
        email: 'another-admin@example.com',
        password: 'admin-password-123',
        role: UserRole.ADMIN,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.INSUFFICIENT_PERMISSION });
    expect(repository.createUserWithAudit).not.toHaveBeenCalled();
  });

  it('passes pagination, filters and search to the repository', async () => {
    repository.findAdminList.mockResolvedValue({ items: [baseUser], total: 1 });
    const result = await service.list({
      page: 2,
      limit: 10,
      sortOrder: 'desc',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      search: ' target ',
    });
    expect(repository.findAdminList).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      search: 'target',
      sortOrder: 'desc',
    });
    expect(result.meta).toMatchObject({ page: 2, limit: 10, total: 1 });
  });

  it('does not allow a moderator to change an admin status', async () => {
    repository.findById.mockResolvedValue({
      ...baseUser,
      role: UserRole.ADMIN,
    });
    const actor: AuthenticatedUser = {
      id: 'moderator',
      role: UserRole.MODERATOR,
      email: null,
      displayName: 'Moderator',
    };
    await expect(
      service.updateStatus(actor, baseUser.id, UserStatus.BLOCKED),
    ).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_PERMISSION,
    });
  });

  it('delegates blocking to the atomic repository operation', async () => {
    repository.findById.mockResolvedValue(baseUser);
    repository.updateStatusAndRevokeSessions.mockResolvedValue({
      ...baseUser,
      status: UserStatus.BLOCKED,
    });
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };
    const result = await service.updateStatus(
      actor,
      baseUser.id,
      UserStatus.BLOCKED,
    );
    expect(repository.updateStatusAndRevokeSessions).toHaveBeenCalledWith({
      actorId: actor.id,
      target: baseUser,
      status: UserStatus.BLOCKED,
    });
    expect(result.status).toBe(UserStatus.BLOCKED);
  });

  it('returns the exact deletion impact for an admin', async () => {
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };
    const counts = {
      authSessions: 2,
      passwordResetTokens: 1,
      businessProfiles: 0,
      businessApplications: 0,
      tradePosts: 1,
      tradeReviews: 3,
      contentReviews: 1,
      reviewReplies: 0,
      conversations: 2,
      messages: 5,
      savedPosts: 1,
      notifications: 4,
      auditLogs: 3,
      harvestBatches: 0,
      feedbackTickets: 0,
      feedbackMessages: 0,
      mediaFiles: 2,
    };
    repository.findById.mockResolvedValue(baseUser);
    repository.getDeletionCounts.mockResolvedValue(counts);

    await expect(
      service.getDeletionImpact(actor, baseUser.id),
    ).resolves.toEqual({
      userId: baseUser.id,
      displayName: baseUser.displayName,
      email: baseUser.email,
      role: baseUser.role,
      counts,
    });
  });

  it('does not allow an admin to delete the currently signed-in account', async () => {
    const actor: AuthenticatedUser = {
      id: baseUser.id,
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };

    await expect(service.deleteAccount(actor, actor.id)).rejects.toMatchObject({
      code: ErrorCode.CANNOT_DELETE_SELF,
    });
    expect(repository.deleteAccountAndRelatedData).not.toHaveBeenCalled();
  });

  it('deletes related data, purges files, then removes media records', async () => {
    const actor: AuthenticatedUser = {
      id: 'admin',
      role: UserRole.ADMIN,
      email: null,
      displayName: 'Admin',
    };
    repository.findById.mockResolvedValue(baseUser);
    repository.deleteAccountAndRelatedData.mockResolvedValue(['media-1']);
    mediaService.purgeStorage.mockResolvedValue(undefined);
    repository.hardDeleteMedia.mockResolvedValue(undefined);

    await service.deleteAccount(actor, baseUser.id);

    expect(repository.deleteAccountAndRelatedData).toHaveBeenCalledWith({
      actorId: actor.id,
      targetId: baseUser.id,
    });
    expect(mediaService.purgeStorage).toHaveBeenCalledWith(['media-1']);
    expect(repository.hardDeleteMedia).toHaveBeenCalledWith(['media-1']);
  });
});
