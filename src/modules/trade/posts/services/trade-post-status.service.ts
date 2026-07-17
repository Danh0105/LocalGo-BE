import { HttpStatus, Injectable } from '@nestjs/common';
import { TradePostStatus } from '../../../../../generated/prisma';
import { assertCanManage } from '../../../../common/authorization/resource-ownership.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { TradePostEntity } from '../entities/trade-post.entity';
import { TradePostRepository } from '../repositories/trade-post.repository';
import { isValidTradePostTransition } from '../utils/trade-post-transitions.util';

@Injectable()
export class TradePostStatusService {
  constructor(
    private readonly tradePostRepository: TradePostRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async submit(user: AuthenticatedUser, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    assertCanManage(user, post, []);
    this.assertTransition(post.status, TradePostStatus.PENDING);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.PENDING,
      rejectedReason: null,
    });
    return new TradePostEntity(updated);
  }

  async approve(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.PUBLISHED);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.PUBLISHED,
      publishedAt: new Date(),
      approvedById: actorId,
      approvedAt: new Date(),
      rejectedReason: null,
    });
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_APPROVE',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status },
      newData: { status: TradePostStatus.PUBLISHED },
    });
    return new TradePostEntity(updated);
  }

  async reject(
    actorId: string,
    id: string,
    reason: string,
  ): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.REJECTED);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.REJECTED,
      rejectedReason: reason,
    });
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_REJECT',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status },
      newData: { status: TradePostStatus.REJECTED, rejectedReason: reason },
    });
    return new TradePostEntity(updated);
  }

  async archive(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.ARCHIVED);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.ARCHIVED,
    });
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_ARCHIVE',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status },
      newData: { status: TradePostStatus.ARCHIVED },
    });
    return new TradePostEntity(updated);
  }

  async hide(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.HIDDEN);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.HIDDEN,
      featured: false,
    });
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_HIDE',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status },
      newData: { status: TradePostStatus.HIDDEN },
    });
    return new TradePostEntity(updated);
  }

  async unhide(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.PUBLISHED);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.PUBLISHED,
    });
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_UNHIDE',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status },
      newData: { status: TradePostStatus.PUBLISHED },
    });
    return new TradePostEntity(updated);
  }

  async deleteApproved(actorId: string, id: string): Promise<void> {
    const post = await this.getActiveOrThrow(id);
    if (
      post.status !== TradePostStatus.PUBLISHED &&
      post.status !== TradePostStatus.HIDDEN
    ) {
      throw new AppException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        'Chỉ có thể xóa tin đã duyệt hoặc đang bị ẩn',
        HttpStatus.CONFLICT,
      );
    }
    await this.tradePostRepository.softDelete(id);
    await this.auditLogService.write({
      actorId,
      action: 'TRADE_POST_DELETE',
      resourceType: 'TradePost',
      resourceId: id,
      oldData: { status: post.status, deletedAt: null },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  async setFeatured(id: string, featured: boolean): Promise<TradePostEntity> {
    await this.getActiveOrThrow(id);
    const updated = await this.tradePostRepository.update(id, { featured });
    return new TradePostEntity(updated);
  }

  private assertTransition(
    current: TradePostStatus,
    target: TradePostStatus,
  ): void {
    if (!isValidTradePostTransition(current, target)) {
      throw new AppException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Không thể chuyển trạng thái từ ${current} sang ${target}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async getActiveOrThrow(id: string) {
    const post = await this.tradePostRepository.findByIdForOwner(id);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    return post;
  }
}
