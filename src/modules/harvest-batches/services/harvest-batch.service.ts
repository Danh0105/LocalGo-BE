import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MediaResourceType, Prisma } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  NotificationType,
  excerpt,
} from '../../notifications/notification-types';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  HarvestBatchResponseDto,
  HarvestTraceResponseDto,
} from '../dto/harvest-batch-response.dto';
import { QueryHarvestBatchesDto } from '../dto/query-harvest-batches.dto';
import {
  CreateHarvestBatchDto,
  UpdateHarvestBatchDto,
} from '../dto/upsert-harvest-batch.dto';
import {
  HARVEST_CODE_PATTERN,
  generateHarvestCode,
  toDateColumn,
  todayInVietnam,
} from '../harvest-batch.constants';
import {
  HARVEST_BATCH_INCLUDE,
  HarvestBatchRepository,
} from '../repositories/harvest-batch.repository';

const CODE_ATTEMPTS = 5;

@Injectable()
export class HarvestBatchService {
  constructor(
    private readonly repository: HarvestBatchRepository,
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly notifications: NotificationService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateHarvestBatchDto,
  ): Promise<HarvestBatchResponseDto> {
    this.assertHarvestDate(dto.harvestDate);
    const id = randomUUID();
    const imageIds = dto.imageIds ?? [];
    await this.mediaService.validateContentImageSet({
      mediaIds: imageIds,
      actorId: user.id,
      resourceType: MediaResourceType.HARVEST_BATCH,
      resourceId: id,
      errorCode: ErrorCode.INVALID_HARVEST_BATCH_MEDIA,
    });
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      try {
        const batch = await this.prisma.$transaction(async (tx) => {
          const created = await tx.harvestBatch.create({
            data: {
              id,
              code: generateHarvestCode(),
              ownerId: user.id,
              ownerName: dto.ownerName ?? user.displayName,
              fruitName: dto.fruitName,
              harvestDate: toDateColumn(dto.harvestDate),
              weightKg: dto.weightKg,
              pricePerKg: dto.pricePerKg,
              fertilizers: dto.fertilizers,
              pesticides: dto.pesticides,
              ...(imageIds.length === 0
                ? {}
                : {
                    images: {
                      create: imageIds.map((mediaId, sortOrder) => ({
                        mediaId,
                        sortOrder,
                      })),
                    },
                  }),
            },
            include: HARVEST_BATCH_INCLUDE,
          });
          await this.mediaService.claimContentImageSet(tx, {
            mediaIds: imageIds,
            actorId: user.id,
            resourceType: MediaResourceType.HARVEST_BATCH,
            resourceId: id,
            errorCode: ErrorCode.INVALID_HARVEST_BATCH_MEDIA,
          });
          return created;
        });
        const result = HarvestBatchResponseDto.fromRecord(batch);
        await this.notifications.notifyStaff(
          {
            type: NotificationType.HARVEST_BATCH_SUBMITTED,
            title: 'Khai báo lô hàng mới',
            body: `${user.displayName} vừa khai báo lô "${excerpt(result.fruitName, 80)}" (${result.code}).`,
            data: {
              harvestBatchId: result.id,
              harvestCode: result.code,
              submittedById: user.id,
            },
          },
          [user.id],
        );
        return result;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Không thể tạo mã lô hàng, vui lòng thử lại',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async list(
    user: AuthenticatedUser,
    query: QueryHarvestBatchesDto,
  ): Promise<PaginatedResultDto<HarvestBatchResponseDto>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const { items, total } = await this.repository.findPageForOwner({
      ownerId: user.id,
      search: query.search || undefined,
      from: query.from,
      to: query.to,
      skip,
      take,
    });
    return paginate(
      items.map((item) => HarvestBatchResponseDto.fromRecord(item)),
      query.page,
      query.limit,
      total,
    );
  }

  async get(
    user: AuthenticatedUser,
    id: string,
  ): Promise<HarvestBatchResponseDto> {
    return HarvestBatchResponseDto.fromRecord(
      await this.getOwnedOrThrow(user, id),
    );
  }

  /** The QR keeps pointing at the same code, so edits show up on printed labels. */
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateHarvestBatchDto,
  ): Promise<HarvestBatchResponseDto> {
    const current = await this.getOwnedOrThrow(user, id);
    if (dto.harvestDate !== undefined) this.assertHarvestDate(dto.harvestDate);
    const previousImageIds = current.images.map((image) => image.mediaId);
    const nextImageIds = dto.imageIds ?? previousImageIds;
    if (dto.imageIds !== undefined) {
      await this.mediaService.validateContentImageSet({
        mediaIds: nextImageIds,
        actorId: user.id,
        resourceType: MediaResourceType.HARVEST_BATCH,
        resourceId: id,
        errorCode: ErrorCode.INVALID_HARVEST_BATCH_MEDIA,
      });
    }
    const { batch, deletedMediaIds } = await this.prisma.$transaction(
      async (tx) => {
        await tx.harvestBatch.update({
          where: { id },
          data: {
            ...(dto.ownerName !== undefined
              ? { ownerName: dto.ownerName }
              : {}),
            ...(dto.fruitName !== undefined
              ? { fruitName: dto.fruitName }
              : {}),
            ...(dto.harvestDate !== undefined
              ? { harvestDate: toDateColumn(dto.harvestDate) }
              : {}),
            ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
            ...(dto.pricePerKg !== undefined
              ? { pricePerKg: dto.pricePerKg }
              : {}),
            ...(dto.fertilizers !== undefined
              ? { fertilizers: dto.fertilizers }
              : {}),
            ...(dto.pesticides !== undefined
              ? { pesticides: dto.pesticides }
              : {}),
          },
        });
        let deletedMediaIds: string[] = [];
        if (dto.imageIds !== undefined) {
          await tx.harvestBatchImage.deleteMany({
            where: { harvestBatchId: id },
          });
          if (nextImageIds.length > 0) {
            await tx.harvestBatchImage.createMany({
              data: nextImageIds.map((mediaId, sortOrder) => ({
                harvestBatchId: id,
                mediaId,
                sortOrder,
              })),
            });
          }
          await this.mediaService.claimContentImageSet(tx, {
            mediaIds: nextImageIds,
            actorId: user.id,
            resourceType: MediaResourceType.HARVEST_BATCH,
            resourceId: id,
            errorCode: ErrorCode.INVALID_HARVEST_BATCH_MEDIA,
          });
          deletedMediaIds = await this.mediaService.releaseContentImageSet(tx, {
            previousMediaIds: previousImageIds,
            nextMediaIds: nextImageIds,
            resourceType: MediaResourceType.HARVEST_BATCH,
            resourceId: id,
          });
        }
        const batch = await tx.harvestBatch.findUniqueOrThrow({
          where: { id },
          include: HARVEST_BATCH_INCLUDE,
        });
        return { batch, deletedMediaIds };
      },
    );
    await this.mediaService.purgeStorage(deletedMediaIds);
    return HarvestBatchResponseDto.fromRecord(batch);
  }

  /** Soft delete — printed labels for the batch stop resolving. */
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const current = await this.getOwnedOrThrow(user, id);
    const previousImageIds = current.images.map((image) => image.mediaId);
    const deletedMediaIds = await this.prisma.$transaction(async (tx) => {
      await tx.harvestBatch.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.harvestBatchImage.deleteMany({
        where: { harvestBatchId: id },
      });
      return this.mediaService.releaseContentImageSet(tx, {
        previousMediaIds: previousImageIds,
        nextMediaIds: [],
        resourceType: MediaResourceType.HARVEST_BATCH,
        resourceId: id,
      });
    });
    await this.mediaService.purgeStorage(deletedMediaIds);
  }

  async trace(code: string): Promise<HarvestTraceResponseDto> {
    const normalized = code.trim().toUpperCase();
    const batch = HARVEST_CODE_PATTERN.test(normalized)
      ? await this.repository.findTraceable(normalized)
      : null;
    if (!batch) {
      throw new AppException(
        ErrorCode.HARVEST_BATCH_NOT_FOUND,
        'Không tìm thấy thông tin lô hàng cho mã này',
        HttpStatus.NOT_FOUND,
      );
    }
    return HarvestTraceResponseDto.fromRecord(batch);
  }

  private async getOwnedOrThrow(user: AuthenticatedUser, id: string) {
    const batch = await this.repository.findForOwner(id, user.id);
    if (!batch) {
      throw new AppException(
        ErrorCode.HARVEST_BATCH_NOT_FOUND,
        'Không tìm thấy lô hàng',
        HttpStatus.NOT_FOUND,
      );
    }
    return batch;
  }

  private assertHarvestDate(date: string): void {
    if (date > todayInVietnam()) {
      throw new AppException(
        ErrorCode.INVALID_HARVEST_DATE,
        'Ngày cắt không được sau ngày hôm nay',
        HttpStatus.BAD_REQUEST,
        [
          {
            field: 'harvestDate',
            messages: ['Ngày cắt không được sau ngày hôm nay'],
          },
        ],
      );
    }
  }
}
