import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BusinessType,
  Prisma,
  UserRole,
  UserStatus,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { BUSINESS_TYPE_CONFIG } from '../business-type.config';
import type { BusinessProfileRecord } from '../dto/business-profile-response.dto';
import type {
  AdminCreateBusinessProfileDto,
  CreateBusinessProfileDto,
  UpdateBusinessProfileDto,
} from '../dto/upsert-business-profile.dto';
import type {
  QueryAdminBusinessProfilesDto,
  QueryBusinessProfilesDto,
} from '../dto/query-business-profiles.dto';

const profileInclude = {
  user: {
    select: {
      displayName: true,
      avatarUrl: true,
      status: true,
    },
  },
} satisfies Prisma.BusinessProfileInclude;

@Injectable()
export class BusinessProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryBusinessProfilesDto) {
    return this.list(query, { includeDeleted: false, publicOnly: true });
  }

  async listAdmin(query: QueryAdminBusinessProfilesDto) {
    return this.list(query, {
      includeDeleted: query.includeDeleted,
      publicOnly: false,
    });
  }

  async getPublic(idOrUserId: string): Promise<BusinessProfileRecord> {
    const profile = await this.prisma.businessProfile.findFirst({
      where: {
        OR: [{ id: idOrUserId }, { userId: idOrUserId }],
        deletedAt: null,
        isPublic: true,
        user: {
          role: UserRole.BUSINESS,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      include: profileInclude,
    });
    if (!profile) throw this.notFound();
    return profile;
  }

  async getMine(userId: string): Promise<BusinessProfileRecord> {
    await this.requireBusinessAccount(userId);
    const profile = await this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
      include: profileInclude,
    });
    if (!profile) throw this.notFound();
    return profile;
  }

  async getAdmin(id: string): Promise<BusinessProfileRecord> {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id },
      include: profileInclude,
    });
    if (!profile) throw this.notFound();
    return profile;
  }

  async createMine(
    userId: string,
    dto: CreateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    return this.createForUser(userId, userId, dto);
  }

  async createAdmin(
    actorId: string,
    dto: AdminCreateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    return this.createForUser(actorId, dto.userId, dto);
  }

  async updateMine(
    userId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    await this.requireBusinessAccount(userId);
    const existing = await this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!existing) throw this.notFound();
    return this.updateRecord(userId, existing.id, existing, dto);
  }

  async updateAdmin(
    actorId: string,
    id: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    const existing = await this.prisma.businessProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw this.notFound();
    await this.requireBusinessAccount(existing.userId);
    return this.updateRecord(actorId, id, existing, dto);
  }

  async deleteMine(userId: string): Promise<void> {
    await this.requireBusinessAccount(userId);
    const existing = await this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!existing) throw this.notFound();
    await this.softDelete(userId, existing.id, existing.version);
  }

  async deleteAdmin(actorId: string, id: string): Promise<void> {
    const existing = await this.prisma.businessProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw this.notFound();
    await this.softDelete(actorId, id, existing.version);
  }

  private async list(
    query: QueryBusinessProfilesDto,
    options: { includeDeleted: boolean; publicOnly: boolean },
  ) {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const search = query.search?.trim();
    const where: Prisma.BusinessProfileWhereInput = {
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      ...(query.businessType ? { businessType: query.businessType } : {}),
      ...(search
        ? {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' } },
              { businessCategory: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { mainProducts: { contains: search, mode: 'insensitive' } },
              { templeName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(options.publicOnly
        ? {
            isPublic: true,
            user: {
              role: UserRole.BUSINESS,
              status: UserStatus.ACTIVE,
              deletedAt: null,
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessProfile.findMany({
        where,
        include: profileInclude,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder },
      }),
      this.prisma.businessProfile.count({ where }),
    ]);
    return paginate(items, query.page, query.limit, total);
  }

  private async createForUser(
    actorId: string,
    userId: string,
    dto: CreateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    const account = await this.requireBusinessAccount(userId);
    const businessType = account.businessType ?? BusinessType.GENERAL;
    this.validateResultingState(businessType, dto);
    const existing = await this.prisma.businessProfile.findUnique({
      where: { userId },
    });
    if (existing && existing.deletedAt === null) {
      throw new AppException(
        ErrorCode.BUSINESS_PROFILE_ALREADY_EXISTS,
        'Tài khoản đã có hồ sơ doanh nghiệp',
        HttpStatus.CONFLICT,
      );
    }
    const data = this.createData(businessType, dto);
    const profile = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.businessProfile.update({
            where: { id: existing.id },
            data: { ...data, deletedAt: null, version: { increment: 1 } },
            include: profileInclude,
          })
        : await tx.businessProfile.create({
            data: { userId, businessType, ...data },
            include: profileInclude,
          });
      await tx.auditLog.create({
        data: {
          actorId,
          action: existing
            ? 'BUSINESS_PROFILE_RESTORED'
            : 'BUSINESS_PROFILE_CREATED',
          resourceType: 'BusinessProfile',
          resourceId: saved.id,
          newData: { userId, businessType, businessName: saved.businessName },
        },
      });
      return saved;
    });
    return profile;
  }

  private async updateRecord(
    actorId: string,
    id: string,
    existing: Prisma.BusinessProfileGetPayload<Record<string, never>>,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileRecord> {
    const merged = { ...existing, ...dto };
    this.validateResultingState(existing.businessType, merged);
    const data = this.updateData(existing.businessType, dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.businessProfile.updateMany({
        where: { id, deletedAt: null, version: dto.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw this.versionConflict();
      const saved = await tx.businessProfile.findUniqueOrThrow({
        where: { id },
        include: profileInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BUSINESS_PROFILE_UPDATED',
          resourceType: 'BusinessProfile',
          resourceId: id,
          oldData: { version: existing.version },
          newData: { version: saved.version, businessName: saved.businessName },
        },
      });
      return saved;
    });
    return updated;
  }

  private async softDelete(
    actorId: string,
    id: string,
    version: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.businessProfile.updateMany({
        where: { id, deletedAt: null, version },
        data: {
          deletedAt: new Date(),
          isPublic: false,
          version: { increment: 1 },
        },
      });
      if (deleted.count !== 1) throw this.versionConflict();
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BUSINESS_PROFILE_DELETED',
          resourceType: 'BusinessProfile',
          resourceId: id,
          oldData: { version },
        },
      });
    });
  }

  private async requireBusinessAccount(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, status: true, businessType: true },
    });
    if (
      !user ||
      user.role !== UserRole.BUSINESS ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new AppException(
        ErrorCode.BUSINESS_ACCOUNT_REQUIRED,
        'Chức năng này chỉ dành cho tài khoản BUSINESS đang hoạt động',
        HttpStatus.FORBIDDEN,
      );
    }
    return user;
  }

  private validateResultingState(
    businessType: BusinessType,
    dto: {
      templeName?: string | null;
      mainProducts?: string | null;
      lat?: unknown;
      lng?: unknown;
    },
  ): void {
    const required =
      businessType === BusinessType.TEMPLE_MANAGEMENT
        ? ([['templeName', 'Tên đền/chùa/miếu']] as const)
        : businessType === BusinessType.GARDEN
          ? ([['mainProducts', 'Sản phẩm/cây trồng chính']] as const)
          : [];
    const missing = required
      .filter(([field]) => !this.cleanString(dto[field]))
      .map(([, label]) => label);
    if (missing.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `Hồ sơ ${BUSINESS_TYPE_CONFIG[businessType].label} còn thiếu: ${missing.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if ((dto.lat == null) !== (dto.lng == null)) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'lat và lng phải được cung cấp hoặc xóa cùng nhau',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private createData(
    businessType: BusinessType,
    dto: CreateBusinessProfileDto,
  ) {
    const applies = this.typeFields(businessType, dto);
    return {
      ...applies,
      businessName: dto.businessName.trim(),
      businessCategory:
        dto.businessCategory?.trim() ||
        BUSINESS_TYPE_CONFIG[businessType].label,
      contactName: dto.contactName.trim(),
      contactPhone: dto.contactPhone.trim(),
      contactEmail: dto.contactEmail.trim().toLowerCase(),
      address: dto.address.trim(),
      googleMapsUrl: this.cleanString(dto.googleMapsUrl),
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      website: this.cleanString(dto.website),
      facebookUrl: this.cleanString(dto.facebookUrl),
      zaloOaUrl: this.cleanString(dto.zaloOaUrl),
      logoUrl: this.cleanString(dto.logoUrl),
      coverImageUrl: this.cleanString(dto.coverImageUrl),
      description: this.cleanString(dto.description),
      isPublic: dto.isPublic ?? true,
    };
  }

  private updateData(
    businessType: BusinessType,
    dto: UpdateBusinessProfileDto,
  ) {
    const data: Prisma.BusinessProfileUpdateManyMutationInput = {};
    const stringFields = [
      'businessName',
      'businessCategory',
      'contactName',
      'contactPhone',
      'contactEmail',
      'address',
      'googleMapsUrl',
      'website',
      'facebookUrl',
      'zaloOaUrl',
      'logoUrl',
      'coverImageUrl',
      'description',
    ] as const;
    for (const field of stringFields) {
      if (dto[field] !== undefined) {
        const value = this.cleanString(dto[field]);
        Object.assign(data, {
          [field]: field === 'contactEmail' ? value?.toLowerCase() : value,
        });
      }
    }
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    Object.assign(data, this.typeFields(businessType, dto, true));
    return data;
  }

  private typeFields(
    businessType: BusinessType,
    dto: Partial<CreateBusinessProfileDto>,
    onlyProvided = false,
  ) {
    const allowed: Record<BusinessType, string[]> = {
      TEMPLE_MANAGEMENT: ['templeName'],
      RESTAURANT: ['openingHours', 'seatingCapacity'],
      ACCOMMODATION: ['openingHours', 'roomCount'],
      GARDEN: ['gardenArea', 'mainProducts'],
      GENERAL: [],
    };
    const fields = [
      'templeName',
      'openingHours',
      'seatingCapacity',
      'roomCount',
      'gardenArea',
      'mainProducts',
    ] as const;
    const result: Record<string, string | number | null> = {};
    for (const field of fields) {
      if (onlyProvided && dto[field] === undefined) continue;
      const value = allowed[businessType].includes(field) ? dto[field] : null;
      result[field] =
        typeof value === 'string' ? this.cleanString(value) : (value ?? null);
    }
    return result;
  }

  private cleanString(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.BUSINESS_PROFILE_NOT_FOUND,
      'Không tìm thấy hồ sơ doanh nghiệp',
      HttpStatus.NOT_FOUND,
    );
  }

  private versionConflict(): AppException {
    return new AppException(
      ErrorCode.BUSINESS_PROFILE_VERSION_CONFLICT,
      'Hồ sơ đã được cập nhật ở nơi khác. Vui lòng tải lại dữ liệu.',
      HttpStatus.CONFLICT,
    );
  }
}
