import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Contact,
  type Media,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  ReorderContactsDto,
  UpdateContactStatusDto,
} from '../dto/contact-action.dto';
import {
  QueryContactAdminDto,
  QueryContactPublicDto,
} from '../dto/query-contact.dto';
import {
  ContactAdminResponseDto,
  ContactListItemResponseDto,
  ContactResponseDto,
} from '../dto/contact-response.dto';
import { CreateContactDto, UpdateContactDto } from '../dto/upsert-contact.dto';
import {
  CONTACT_CATEGORY_FROM_DB,
  CONTACT_CATEGORY_TO_DB,
} from '../contact.constants';

type ContactRecord = Contact & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeContact = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryContactPublicDto,
  ): Promise<ContactListItemResponseDto[]> {
    const records = await this.prisma.contact.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: CONTACT_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeContact,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<ContactResponseDto> {
    const record = await this.prisma.contact.findFirst({
      where: { id, isActive: true },
      include: includeContact,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryContactAdminDto) {
    const where: Prisma.ContactWhereInput = {
      ...(query.category
        ? { category: CONTACT_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeContact,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<ContactAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateContactDto,
  ): Promise<ContactAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.contact.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.contact.create({
        data: {
          id,
          name: dto.name,
          category: CONTACT_CATEGORY_TO_DB[dto.category],
          role: dto.role,
          phone: dto.phone,
          email: dto.email ?? null,
          address: dto.address,
          workingTime: dto.workingTime,
          summary: dto.summary,
          description: dto.description,
          supportTopics: dto.supportTopics,
          note: dto.note,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeContact,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CONTACT_CREATED',
          resourceType: 'Contact',
          resourceId: id,
          newData: { version: 1 },
        },
      });
      return created;
    });
    return this.toAdminDto(record);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<ContactAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.contact.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: CONTACT_CATEGORY_TO_DB[dto.category],
            role: dto.role,
            phone: dto.phone,
            email: dto.email ?? null,
            address: dto.address,
            workingTime: dto.workingTime,
            summary: dto.summary,
            description: dto.description,
            supportTopics: dto.supportTopics,
            note: dto.note,
            mediaId: dto.mediaId ?? null,
            imageAlt: dto.imageAlt,
            ...(dto.sortOrder === undefined
              ? {}
              : { sortOrder: dto.sortOrder }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (updated.count !== 1) throw await this.versionConflict(tx, id);

        const deletedMediaId = await this.mediaService.releaseSingularMedia(
          tx,
          {
            previousMediaId: current.mediaId,
            nextMediaId: dto.mediaId ?? null,
            resourceType: MediaResourceType.CONTACT,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CONTACT_UPDATED',
            resourceType: 'Contact',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.contact.findUniqueOrThrow({
          where: { id },
          include: includeContact,
        });
        return { record, deletedMediaId };
      },
    );
    await this.mediaService.purgeStorage([deletedMediaId]);
    return this.toAdminDto(record);
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateContactStatusDto,
  ): Promise<ContactAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contact.updateMany({
        where: { id, version: dto.version },
        data: {
          isActive: dto.isActive,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) throw await this.versionConflict(tx, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: dto.isActive ? 'CONTACT_SHOWN' : 'CONTACT_HIDDEN',
          resourceType: 'Contact',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.contact.findUniqueOrThrow({
        where: { id },
        include: includeContact,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderContactsDto,
  ): Promise<ContactAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.contact.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.contact.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CONTACTS_REORDERED',
          resourceType: 'Contact',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.contact.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeContact,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.contact.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.CONTACT,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CONTACT_DELETED',
          resourceType: 'Contact',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<ContactRecord> {
    const record = await this.prisma.contact.findUnique({
      where: { id },
      include: includeContact,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: ContactRecord): ContactListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: CONTACT_CATEGORY_FROM_DB[record.category],
      role: record.role,
      phone: record.phone,
      email: record.email,
      address: record.address,
      workingTime: record.workingTime,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: ContactRecord): ContactResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      supportTopics: this.readStringArray(record.supportTopics),
      note: record.note,
    };
  }

  private toAdminDto(record: ContactRecord): ContactAdminResponseDto {
    return {
      ...this.toPublicDto(record),
      mediaId: record.mediaId,
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      createdBy: record.createdBy?.displayName ?? null,
      updatedBy: record.updatedBy?.displayName ?? null,
    };
  }

  private readStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    contactId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.CONTACT &&
          (media.resourceId === contactId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_CONTACT_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    contactId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const claimed = await tx.media.updateMany({
      where: {
        id: mediaId,
        ownerId: actorId,
        resourceType: null,
        deletedAt: null,
      },
      data: {
        resourceType: MediaResourceType.CONTACT,
        resourceId: contactId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.CONTACT,
          OR: [{ resourceId: contactId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_CONTACT_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.contact.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.contact.findUnique({
      where: { id },
      include: includeContact,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.CONTACT_VERSION_CONFLICT,
      'Liên hệ đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.CONTACT_NOT_FOUND,
      'Không tìm thấy liên hệ',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.CONTACT_SLUG_EXISTS,
      'Slug liên hệ đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}
