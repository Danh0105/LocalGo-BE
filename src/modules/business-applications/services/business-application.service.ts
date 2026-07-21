import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BusinessApplicantType,
  BusinessApplicationStatus,
  BusinessDocumentType,
  MediaResourceType,
  Prisma,
  UserRole,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import { QueryBusinessApplicationsDto } from '../dto/query-business-applications.dto';
import { UpsertBusinessApplicationDto } from '../dto/upsert-business-application.dto';
import { BusinessApplicationEntity } from '../entities/business-application.entity';
import {
  BusinessApplicationRepository,
  type BusinessApplicationRecord,
} from '../repositories/business-application.repository';
import { BusinessDocumentAccessService } from './business-document-access.service';

@Injectable()
export class BusinessApplicationService {
  constructor(
    private readonly repository: BusinessApplicationRepository,
    private readonly prisma: PrismaService,
    private readonly documentAccess: BusinessDocumentAccessService,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    userId: string,
    dto: UpsertBusinessApplicationDto,
  ): Promise<BusinessApplicationEntity> {
    this.validateByApplicantType(dto);
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.businessApplication.count({
        where: {
          status: BusinessApplicationStatus.PENDING,
          OR: [{ submittedById: userId }, { zaloId: dto.zaloId }],
        },
      });
      if (pending > 0) {
        throw new AppException(
          ErrorCode.PENDING_APPLICATION_EXISTS,
          'Bạn đang có một hồ sơ chờ duyệt',
          HttpStatus.CONFLICT,
        );
      }
      await this.validateAndClaimMedia(tx, userId, id, dto);
      await tx.businessApplication.create({
        data: {
          id,
          ...this.applicationData(dto),
          submittedById: userId,
          documents: {
            create: dto.documents.map((document) => ({
              mediaId: document.mediaId,
              type: document.type,
              name: document.name,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'BUSINESS_APPLICATION_SUBMITTED',
          resourceType: 'BusinessApplication',
          resourceId: id,
          newData: {
            applicantType: dto.applicantType,
            status: BusinessApplicationStatus.PENDING,
          },
        },
      });
    });
    return this.getByIdOrThrow(id);
  }

  async getMine(userId: string): Promise<BusinessApplicationEntity> {
    const record = await this.repository.findLatestForUser(userId);
    if (!record) throw this.notFound();
    return this.toEntity(record);
  }

  async checkByZaloId(
    zaloId: string,
  ): Promise<{ exists: boolean; status: BusinessApplicationStatus | null }> {
    const record = await this.repository.findLatestStatusByZaloId(zaloId);
    return { exists: !!record, status: record?.status ?? null };
  }

  async update(
    userId: string,
    id: string,
    dto: UpsertBusinessApplicationDto,
  ): Promise<BusinessApplicationEntity> {
    this.validateByApplicantType(dto);
    const existing = await this.repository.findById(id);
    if (!existing || existing.submittedById !== userId) throw this.notFound();
    if (existing.status !== BusinessApplicationStatus.REJECTED) {
      throw new AppException(
        ErrorCode.APPLICATION_NOT_EDITABLE,
        'Chỉ có thể sửa hồ sơ đã bị từ chối',
        HttpStatus.CONFLICT,
      );
    }
    let removedMediaIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      await this.validateAndClaimMedia(tx, userId, id, dto);
      const previousDocuments = await tx.businessApplicationDocument.findMany({
        where: { applicationId: id },
        select: { mediaId: true },
      });
      const nextMediaIds = dto.documents.map((document) => document.mediaId);
      removedMediaIds = previousDocuments
        .map((document) => document.mediaId)
        .filter((mediaId) => !nextMediaIds.includes(mediaId));
      await tx.businessApplicationDocument.deleteMany({
        where: { applicationId: id },
      });
      await tx.businessApplication.update({
        where: { id },
        data: {
          ...this.applicationData(dto),
          status: BusinessApplicationStatus.PENDING,
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
          documents: {
            create: dto.documents.map((document) => ({
              mediaId: document.mediaId,
              type: document.type,
              name: document.name,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'BUSINESS_APPLICATION_RESUBMITTED',
          resourceType: 'BusinessApplication',
          resourceId: id,
          oldData: { status: existing.status },
          newData: { status: BusinessApplicationStatus.PENDING },
        },
      });
    });
    if (removedMediaIds.length > 0) {
      const deletedMediaIds =
        await this.mediaService.pruneDetachedMedia(removedMediaIds);
      await this.mediaService.purgeStorage(deletedMediaIds);
    }
    return this.getByIdOrThrow(id);
  }

  async listForAdmin(
    query: QueryBusinessApplicationsDto,
  ): Promise<PaginatedResultDto<BusinessApplicationEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const result = await this.repository.findAdminList({
      skip,
      take,
      status: query.status,
      applicantType: query.applicantType,
      search: query.search?.trim(),
      sortOrder: query.sortOrder,
    });
    return paginate(
      result.items.map((item) => this.toEntity(item)),
      query.page,
      query.limit,
      result.total,
    );
  }

  async approve(actorId: string, id: string): Promise<BusinessApplicationEntity> {
    await this.prisma.$transaction(
      async (tx) => {
        const application = await tx.businessApplication.findUnique({
          where: { id },
        });
        if (!application) throw this.notFound();
        if (application.status !== BusinessApplicationStatus.PENDING)
          throw this.alreadyReviewed();
        if (!application.submittedById) {
          throw new AppException(
            ErrorCode.INVALID_BUSINESS_APPLICATION,
            'Hồ sơ không còn liên kết với tài khoản Zalo đã nộp.',
            HttpStatus.CONFLICT,
          );
        }
        const submitter = await tx.user.findFirst({
          where: { id: application.submittedById, deletedAt: null },
        });
        if (!submitter) {
          throw new AppException(
            ErrorCode.INVALID_BUSINESS_APPLICATION,
            'Không tìm thấy tài khoản Zalo đã nộp hồ sơ.',
            HttpStatus.CONFLICT,
          );
        }
        const normalizedEmail = application.contactEmail.trim().toLowerCase();
        if (
          await tx.user.count({
            where: {
              phone: application.contactPhone,
              deletedAt: null,
              id: { not: submitter.id },
            },
          })
        ) {
          throw new AppException(
            ErrorCode.PHONE_ALREADY_EXISTS,
            'Số điện thoại trong hồ sơ đã thuộc về một tài khoản khác.',
            HttpStatus.CONFLICT,
          );
        }
        if (
          await tx.user.count({
            where: {
              email: normalizedEmail,
              deletedAt: null,
              id: { not: submitter.id },
            },
          })
        ) {
          throw new AppException(
            ErrorCode.EMAIL_ALREADY_EXISTS,
            'Email trong hồ sơ đã thuộc về một tài khoản khác.',
            HttpStatus.CONFLICT,
          );
        }
        const claimed = await tx.businessApplication.updateMany({
          where: { id, status: BusinessApplicationStatus.PENDING },
          data: {
            status: BusinessApplicationStatus.APPROVED,
            reviewedById: actorId,
            reviewedAt: new Date(),
          },
        });
        if (claimed.count !== 1) throw this.alreadyReviewed();
        const user = await tx.user.update({
          where: { id: submitter.id },
          data: {
            displayName: submitter.displayName || application.contactName,
            email: normalizedEmail,
            phone: application.contactPhone,
            role: UserRole.BUSINESS,
          },
        });
        await tx.businessApplication.update({
          where: { id },
          data: { createdUserId: user.id },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'BUSINESS_APPLICATION_APPROVED',
            resourceType: 'BusinessApplication',
            resourceId: id,
            oldData: { status: BusinessApplicationStatus.PENDING },
            newData: {
              status: BusinessApplicationStatus.APPROVED,
              createdUserId: user.id,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.getByIdOrThrow(id);
  }

  async reject(
    actorId: string,
    id: string,
    reason: string,
  ): Promise<BusinessApplicationEntity> {
    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.businessApplication.findUnique({
          where: { id },
        });
        if (!existing) throw this.notFound();
        const updated = await tx.businessApplication.updateMany({
          where: { id, status: BusinessApplicationStatus.PENDING },
          data: {
            status: BusinessApplicationStatus.REJECTED,
            rejectionReason: reason.trim(),
            reviewedById: actorId,
            reviewedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw this.alreadyReviewed();
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'BUSINESS_APPLICATION_REJECTED',
            resourceType: 'BusinessApplication',
            resourceId: id,
            oldData: { status: BusinessApplicationStatus.PENDING },
            newData: {
              status: BusinessApplicationStatus.REJECTED,
              rejectionReason: reason.trim(),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.getByIdOrThrow(id);
  }

  validateByApplicantType(dto: UpsertBusinessApplicationDto): void {
    const types = new Set(dto.documents.map((document) => document.type));
    if (
      new Set(dto.documents.map((document) => document.mediaId)).size !==
      dto.documents.length
    ) {
      throw this.invalid('Mỗi tài liệu chỉ được sử dụng một lần');
    }
    if (dto.applicantType === BusinessApplicantType.INDIVIDUAL) {
      if (
        !dto.identityNumber?.trim() ||
        !dto.identityIssuedAt ||
        !dto.identityIssuedPlace?.trim()
      ) {
        throw this.invalid('Hồ sơ cá nhân phải có đầy đủ thông tin CCCD');
      }
      if (
        !types.has(BusinessDocumentType.IDENTITY_FRONT) ||
        !types.has(BusinessDocumentType.IDENTITY_BACK)
      ) {
        throw this.invalid(
          'Hồ sơ cá nhân phải có ảnh CCCD mặt trước và mặt sau',
        );
      }
    } else if (
      !dto.legalName?.trim() ||
      !dto.taxCode?.trim() ||
      !dto.representativeName?.trim() ||
      !dto.representativeTitle?.trim() ||
      !types.has(BusinessDocumentType.BUSINESS_LICENSE)
    ) {
      throw this.invalid(
        'Hồ sơ doanh nghiệp phải có pháp nhân, mã số thuế, người đại diện và giấy phép kinh doanh',
      );
    }
  }

  private async validateAndClaimMedia(
    tx: Prisma.TransactionClient,
    userId: string,
    applicationId: string,
    dto: UpsertBusinessApplicationDto,
  ): Promise<void> {
    const ids = dto.documents.map((document) => document.mediaId);
    const media = await tx.media.findMany({
      where: {
        id: { in: ids },
        ownerId: userId,
        deletedAt: null,
        OR: [
          { resourceType: null },
          {
            resourceType: MediaResourceType.BUSINESS_APPLICATION,
            resourceId: applicationId,
          },
        ],
      },
    });
    const allowedMime = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
    const allowedName = /\.(jpe?g|png|webp|pdf)$/i;
    if (
      media.length !== ids.length ||
      media.some((item) => !allowedMime.test(item.mimeType)) ||
      dto.documents.some((item) => !allowedName.test(item.name))
    ) {
      throw new AppException(
        ErrorCode.INVALID_BUSINESS_DOCUMENT,
        'Tài liệu không hợp lệ, không thuộc người nộp hoặc có định dạng không được hỗ trợ',
        HttpStatus.BAD_REQUEST,
      );
    }
    await tx.media.updateMany({
      where: { id: { in: ids } },
      data: {
        resourceType: MediaResourceType.BUSINESS_APPLICATION,
        resourceId: applicationId,
      },
    });
  }

  private applicationData(dto: UpsertBusinessApplicationDto) {
    return {
      applicantType: dto.applicantType,
      businessName: dto.businessName.trim(),
      businessCategory: dto.businessCategory.trim(),
      contactName: dto.contactName.trim(),
      contactPhone: dto.contactPhone.trim(),
      contactEmail: dto.contactEmail.trim().toLowerCase(),
      address: dto.address.trim(),
      identityNumber: dto.identityNumber?.trim() || null,
      identityIssuedAt: dto.identityIssuedAt
        ? new Date(dto.identityIssuedAt)
        : null,
      identityIssuedPlace: dto.identityIssuedPlace?.trim() || null,
      legalName: dto.legalName?.trim() || null,
      taxCode: dto.taxCode?.trim() || null,
      representativeName: dto.representativeName?.trim() || null,
      representativeTitle: dto.representativeTitle?.trim() || null,
      website: dto.website?.trim() || null,
      description: dto.description?.trim() || null,
      zaloId: dto.zaloId.trim(),
      zaloDisplayName: dto.zaloDisplayName?.trim() || null,
      zaloAvatarUrl: dto.zaloAvatarUrl?.trim() || null,
    };
  }

  private async getByIdOrThrow(id: string): Promise<BusinessApplicationEntity> {
    const record = await this.repository.findById(id);
    if (!record) throw this.notFound();
    return this.toEntity(record);
  }

  private toEntity(
    record: BusinessApplicationRecord,
  ): BusinessApplicationEntity {
    return new BusinessApplicationEntity(record, (documentId) =>
      this.documentAccess.createSignedUrl(documentId),
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.APPLICATION_NOT_FOUND,
      'Không tìm thấy hồ sơ đăng ký BUSINESS',
      HttpStatus.NOT_FOUND,
    );
  }

  private alreadyReviewed(): AppException {
    return new AppException(
      ErrorCode.APPLICATION_ALREADY_REVIEWED,
      'Hồ sơ đã được xử lý bởi quản trị viên khác. Vui lòng tải lại danh sách.',
      HttpStatus.CONFLICT,
    );
  }

  private invalid(message: string): AppException {
    return new AppException(
      ErrorCode.INVALID_BUSINESS_APPLICATION,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }
}
