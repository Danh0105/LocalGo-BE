import { Injectable } from '@nestjs/common';
import {
  SessionRevokeReason,
  type Prisma,
  type User,
  type UserRole,
  type UserStatus,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByZaloId(zaloId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { zaloId, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  touchLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { displayName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortOrder = params.sortOrder ?? 'desc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  updateStatusAndRevokeSessions(params: {
    actorId: string;
    target: User;
    status: UserStatus;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.target.id },
        data: { status: params.status },
      });
      if (params.status === 'BLOCKED') {
        await tx.authSession.updateMany({
          where: { userId: params.target.id, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: SessionRevokeReason.ADMIN_REVOKED,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'USER_STATUS_UPDATED',
          resourceType: 'User',
          resourceId: params.target.id,
          oldData: { status: params.target.status },
          newData: { status: params.status },
        },
      });
      return updated;
    });
  }
}
