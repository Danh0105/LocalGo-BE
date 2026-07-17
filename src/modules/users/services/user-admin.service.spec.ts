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
  role: UserRole.USER,
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
  };
  const service = new UserAdminService(repository as never);

  beforeEach(() => jest.clearAllMocks());

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
});
