import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  BusinessApplicationStatus,
  BusinessType,
  MediaResourceType,
  Prisma,
  UserRole,
  UserStatus,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import { generateInitialPassword } from '../../../common/security/initial-password';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  NotificationType,
  excerpt,
} from '../../notifications/notification-types';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  BUSINESS_APPLICATION_FIELD_LABEL,
  BUSINESS_DOCUMENT_TYPE_LABEL,
  BUSINESS_TYPE_CONFIG,
  TYPE_SPECIFIC_FIELDS,
} from '../business-type.config';
import { ApproveBusinessApplicationDto } from '../dto/approve-business-application.dto';
import { BusinessApplicationDocumentInputDto } from '../dto/business-application-document-input.dto';
import { QueryBusinessApplicationsDto } from '../dto/query-business-applications.dto';
import { SubmitBusinessApplicationRequestDto } from '../dto/submit-business-application-request.dto';
import { UpsertBusinessApplicationDto } from '../dto/upsert-business-application.dto';
import { BusinessApplicationEntity } from '../entities/business-application.entity';
import {
  BusinessApplicationRepository,
  type BusinessApplicationRecord,
} from '../repositories/business-application.repository';
import { BusinessDocumentAccessService } from './business-document-access.service';

type AnonymousBusinessApplicationInput = SubmitBusinessApplicationRequestDto & {
  zaloId?: null;
  zaloDisplayName?: null;
  zaloAvatarUrl?: null;
};

type BusinessApplicationInput =
  UpsertBusinessApplicationDto | AnonymousBusinessApplicationInput;

export interface BusinessApplicationApprovalResult {
  application: BusinessApplicationEntity;
  initialPassword: string | null;
}

@Injectable()
export class BusinessApplicationService {
  constructor(
    private readonly repository: BusinessApplicationRepository,
    private readonly prisma: PrismaService,
    private readonly documentAccess: BusinessDocumentAccessService,
    private readonly mediaService: MediaService,
    private readonly notifications: NotificationService,
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
          OR: [{ submittedById: userId }, { zaloId: dto.zaloId.trim() }],
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
    const application = await this.getByIdOrThrow(id);
    await this.notifyStaffOfSubmission(application, false, userId);
    return application;
  }

  async createAnonymous(
    dto: SubmitBusinessApplicationRequestDto,
  ): Promise<BusinessApplicationEntity> {
    this.validateByApplicantType(dto);
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.businessApplication.count({
        where: {
          status: BusinessApplicationStatus.PENDING,
          OR: [
            { contactEmail: dto.contactEmail.trim().toLowerCase() },
            { contactPhone: dto.contactPhone.trim() },
          ],
        },
      });
      if (pending > 0) {
        throw new AppException(
          ErrorCode.PENDING_APPLICATION_EXISTS,
          'Thông tin liên hệ này đang có một hồ sơ chờ duyệt',
          HttpStatus.CONFLICT,
        );
      }
      await this.validateAndClaimMedia(tx, null, id, dto);
      await tx.businessApplication.create({
        data: {
          id,
          ...this.applicationData(dto),
          submittedById: null,
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
          actorId: null,
          action: 'BUSINESS_APPLICATION_SUBMITTED_ANONYMOUSLY',
          resourceType: 'BusinessApplication',
          resourceId: id,
          newData: {
            applicantType: dto.applicantType,
            status: BusinessApplicationStatus.PENDING,
          },
        },
      });
    });
    const application = await this.getByIdOrThrow(id);
    await this.notifyStaffOfSubmission(application, false);
    return application;
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
    const application = await this.getByIdOrThrow(id);
    await this.notifyStaffOfSubmission(application, true, userId);
    return application;
  }

  private notifyStaffOfSubmission(
    application: BusinessApplicationEntity,
    resubmitted: boolean,
    submittedById?: string,
  ): Promise<void> {
    return this.notifications.notifyStaff({
      type: NotificationType.BUSINESS_APPLICATION_SUBMITTED,
      title: resubmitted ? 'Hồ sơ Business được gửi lại' : 'Hồ sơ Business mới',
      body: `${application.contactName} ${resubmitted ? 'đã gửi lại' : 'vừa gửi'} hồ sơ "${excerpt(application.businessName, 90)}" để duyệt.`,
      data: {
        applicationId: application.id,
        ...(submittedById ? { submittedById } : {}),
      },
    });
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
      businessType: query.businessType,
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

  async approve(
    actorId: string,
    id: string,
    dto: ApproveBusinessApplicationDto = {},
  ): Promise<BusinessApplicationApprovalResult> {
    const generatedPassword = generateInitialPassword();
    const generatedPasswordHash = await argon2.hash(generatedPassword);
    let issuedInitialPassword = false;
    await this.prisma.$transaction(
      async (tx) => {
        const application = await tx.businessApplication.findUnique({
          where: { id },
        });
        if (!application) throw this.notFound();
        if (application.status !== BusinessApplicationStatus.PENDING)
          throw this.alreadyReviewed();
        const submitter = application.submittedById
          ? await tx.user.findFirst({
              where: { id: application.submittedById, deletedAt: null },
            })
          : null;
        if (application.submittedById && !submitter) {
          throw new AppException(
            ErrorCode.INVALID_BUSINESS_APPLICATION,
            'Không tìm thấy tài khoản Zalo đã nộp hồ sơ.',
            HttpStatus.CONFLICT,
          );
        }
        const needsInitialPassword = !submitter?.passwordHash;
        const normalizedEmail = application.contactEmail.trim().toLowerCase();
        if (
          await tx.user.count({
            where: {
              phone: application.contactPhone,
              deletedAt: null,
              ...(submitter ? { id: { not: submitter.id } } : {}),
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
              ...(submitter ? { id: { not: submitter.id } } : {}),
            },
          })
        ) {
          throw new AppException(
            ErrorCode.EMAIL_ALREADY_EXISTS,
            'Email trong hồ sơ đã thuộc về một tài khoản khác.',
            HttpStatus.CONFLICT,
          );
        }
        if (dto.documents && dto.documents.length > 0) {
          // Admin-supplied documents (e.g. citizen registered in person at
          // UBND and admin is entering the paperwork on their behalf) —
          // uploaded via the admin's own account, so ownerId = actorId.
          await this.validateAndClaimMedia(tx, actorId, id, {
            documents: dto.documents,
          });
          await tx.businessApplicationDocument.createMany({
            data: dto.documents.map((document) => ({
              applicationId: id,
              mediaId: document.mediaId,
              type: document.type,
              name: document.name,
            })),
          });
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
        const user = submitter
          ? await tx.user.update({
              where: { id: submitter.id },
              data: {
                displayName: submitter.displayName || application.contactName,
                email: normalizedEmail,
                phone: application.contactPhone,
                role: UserRole.BUSINESS,
                businessType: application.businessType,
                ...(needsInitialPassword
                  ? {
                      passwordHash: generatedPasswordHash,
                      credentialVersion: { increment: 1 },
                    }
                  : {}),
              },
            })
          : await tx.user.create({
              data: {
                displayName: application.contactName,
                email: normalizedEmail,
                phone: application.contactPhone,
                passwordHash: generatedPasswordHash,
                role: UserRole.BUSINESS,
                businessType: application.businessType,
                status: UserStatus.ACTIVE,
              },
            });
        issuedInitialPassword = needsInitialPassword;
        if (needsInitialPassword) {
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'INITIAL_PASSWORD_ISSUED',
              resourceType: 'User',
              resourceId: user.id,
            },
          });
        }
        await tx.businessApplication.update({
          where: { id },
          data: { createdUserId: user.id },
        });
        await tx.businessProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            businessType: application.businessType,
            businessName: application.businessName,
            businessCategory: application.businessCategory,
            templeName: application.templeName,
            openingHours: application.openingHours,
            seatingCapacity: application.seatingCapacity,
            roomCount: application.roomCount,
            gardenArea: application.gardenArea,
            mainProducts: application.mainProducts,
            contactName: application.contactName,
            contactPhone: application.contactPhone,
            contactEmail: normalizedEmail,
            address: application.address,
            website: application.website,
            description: application.description,
          },
          update: {
            businessType: application.businessType,
            businessName: application.businessName,
            businessCategory: application.businessCategory,
            templeName: application.templeName,
            openingHours: application.openingHours,
            seatingCapacity: application.seatingCapacity,
            roomCount: application.roomCount,
            gardenArea: application.gardenArea,
            mainProducts: application.mainProducts,
            contactName: application.contactName,
            contactPhone: application.contactPhone,
            contactEmail: normalizedEmail,
            address: application.address,
            website: application.website,
            description: application.description,
            isPublic: true,
            deletedAt: null,
            version: { increment: 1 },
          },
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
    const approved = await this.getByIdOrThrow(id);
    await this.notifications.notify(approved.createdUserId, {
      type: NotificationType.BUSINESS_APPLICATION_APPROVED,
      title: 'Hồ sơ đăng ký đã được duyệt',
      body: `Hồ sơ "${excerpt(approved.businessName, 80)}" đã được duyệt. Bạn có thể đăng tin giao thương ngay.`,
      data: { applicationId: id },
    });
    return {
      application: approved,
      initialPassword: issuedInitialPassword ? generatedPassword : null,
    };
  }

  async reject(
    actorId: string,
    id: string,
    reason: string,
  ): Promise<BusinessApplicationEntity> {
    let submittedById: string | null = null;
    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.businessApplication.findUnique({
          where: { id },
        });
        if (!existing) throw this.notFound();
        submittedById = existing.submittedById;
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
    const rejected = await this.getByIdOrThrow(id);
    // Public requests have no account to notify; Zalo submitters do.
    await this.notifications.notify(submittedById, {
      type: NotificationType.BUSINESS_APPLICATION_REJECTED,
      title: 'Hồ sơ đăng ký bị từ chối',
      body: `Hồ sơ "${excerpt(rejected.businessName, 80)}" bị từ chối: ${excerpt(reason, 200)}. Bạn có thể sửa và gửi lại.`,
      data: { applicationId: id, reason: reason.trim() },
    });
    return rejected;
  }

  /**
   * Checks the fields and documents required by the application's business
   * type (BUSINESS_TYPE_CONFIG) for the chosen applicant type. Missing
   * businessType means GENERAL, which keeps the original individual /
   * organization rules.
   */
  validateByApplicantType(dto: BusinessApplicationInput): void {
    if (
      new Set(dto.documents.map((document) => document.mediaId)).size !==
      dto.documents.length
    ) {
      throw this.invalid('Mỗi tài liệu chỉ được sử dụng một lần');
    }

    const config =
      BUSINESS_TYPE_CONFIG[dto.businessType ?? BusinessType.GENERAL];
    const requirement = config.requirements[dto.applicantType];
    if (!requirement) {
      throw this.invalid(
        `${config.label} chỉ đăng ký dưới dạng ${config.applicantTypes
          .map((type) => (type === 'INDIVIDUAL' ? 'cá nhân' : 'tổ chức'))
          .join(' hoặc ')}`,
      );
    }

    const missingFields = [
      ...requirement.requiredFields,
      ...config.requiredFields,
    ].filter((field) => {
      const value = dto[field];
      return value == null || (typeof value === 'string' && !value.trim());
    });
    const documentTypes = new Set(
      dto.documents.map((document) => document.type),
    );
    const missingDocuments = requirement.requiredDocuments.filter(
      (type) => !documentTypes.has(type),
    );
    if (missingFields.length > 0 || missingDocuments.length > 0) {
      const missing = [
        ...new Set(
          missingFields.map((field) => BUSINESS_APPLICATION_FIELD_LABEL[field]),
        ),
        ...missingDocuments.map((type) => BUSINESS_DOCUMENT_TYPE_LABEL[type]),
      ];
      throw this.invalid(
        `Hồ sơ ${config.label.toLowerCase()} còn thiếu: ${missing.join(', ')}`,
      );
    }
  }

  private async validateAndClaimMedia(
    tx: Prisma.TransactionClient,
    userId: string | null,
    applicationId: string,
    dto: { documents: BusinessApplicationDocumentInputDto[] },
  ): Promise<void> {
    const ids = dto.documents.map((document) => document.mediaId);
    const claimableWhere: Prisma.MediaWhereInput = {
      id: { in: ids },
      ownerId: userId,
      deletedAt: null,
      ...(userId === null
        ? {
            resourceType: MediaResourceType.BUSINESS_APPLICATION,
            resourceId: null,
          }
        : {
            OR: [
              { resourceType: null },
              {
                resourceType: MediaResourceType.BUSINESS_APPLICATION,
                resourceId: applicationId,
              },
            ],
          }),
    };
    const media = await tx.media.findMany({
      where: claimableWhere,
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
    const claimed = await tx.media.updateMany({
      where: claimableWhere,
      data: {
        resourceType: MediaResourceType.BUSINESS_APPLICATION,
        resourceId: applicationId,
      },
    });
    if (claimed.count !== ids.length) {
      throw new AppException(
        ErrorCode.INVALID_BUSINESS_DOCUMENT,
        'Một hoặc nhiều tài liệu đã được sử dụng, vui lòng tải lên lại',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private applicationData(dto: BusinessApplicationInput) {
    const businessType = dto.businessType ?? BusinessType.GENERAL;
    const config = BUSINESS_TYPE_CONFIG[businessType];
    const appliesToType = new Set([
      ...config.requiredFields,
      ...config.optionalFields,
    ]);
    // Drop details that belong to another business type (e.g. a room count
    // left over after switching the form from hotel to restaurant).
    const typeSpecific = Object.fromEntries(
      TYPE_SPECIFIC_FIELDS.map((field) => {
        const value = appliesToType.has(field) ? dto[field] : null;
        return [
          field,
          typeof value === 'string' ? value.trim() || null : (value ?? null),
        ];
      }),
    ) as {
      templeName: string | null;
      openingHours: string | null;
      seatingCapacity: number | null;
      roomCount: number | null;
      gardenArea: string | null;
      mainProducts: string | null;
    };
    return {
      applicantType: dto.applicantType,
      businessType,
      ...typeSpecific,
      businessName: dto.businessName.trim(),
      businessCategory: dto.businessCategory?.trim() || config.label,
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
      zaloId: dto.zaloId?.trim() || null,
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
