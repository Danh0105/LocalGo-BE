import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BusinessType,
  TradePostPurpose,
  TradePostStatus,
} from '../../../../../generated/prisma';
import { assertCanManage } from '../../../../common/authorization/resource-ownership.util';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  BUSINESS_TYPE_CONFIG,
  allowedPostPurposes,
} from '../../../business-applications/business-type.config';
import {
  NotificationType,
  excerpt,
} from '../../../notifications/notification-types';
import { NotificationService } from '../../../notifications/services/notification.service';
import { UserService } from '../../../users/services/user.service';
import { ZaloOaMessagingService } from '../../../zalo/services/zalo-oa-messaging.service';
import { TradePostEntity } from '../entities/trade-post.entity';
import { TradePostRepository } from '../repositories/trade-post.repository';
import { effectiveExpiry } from '../utils/trade-post-business-rules.util';
import { isValidTradePostTransition } from '../utils/trade-post-transitions.util';

@Injectable()
export class TradePostStatusService {
  constructor(
    private readonly tradePostRepository: TradePostRepository,
    private readonly auditLogService: AuditLogService,
    private readonly userService: UserService,
    private readonly zaloOaMessagingService: ZaloOaMessagingService,
    private readonly notifications: NotificationService,
  ) {}

  async submit(user: AuthenticatedUser, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    assertCanManage(user, post, []);
    await this.assertPurposeAllowed(post);
    this.assertTransition(post.status, TradePostStatus.PENDING);
    this.assertNotExpired(post);

    const updated = await this.tradePostRepository.update(id, {
      status: TradePostStatus.PENDING,
      rejectedReason: null,
    });
    await this.notifications.notifyStaff({
      type: NotificationType.TRADE_POST_SUBMITTED,
      title: 'Tin giao thương chờ duyệt',
      body: `${user.displayName} vừa gửi tin "${excerpt(updated.title, 90)}" để duyệt.`,
      data: {
        tradePostId: updated.id,
        slug: updated.slug,
        submittedById: user.id,
      },
    });
    return new TradePostEntity(updated);
  }

  async approve(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    await this.assertPurposeAllowed(post);
    this.assertTransition(post.status, TradePostStatus.PUBLISHED);
    this.assertNotExpired(post);

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

    const zaloId = await this.userService.findZaloIdById(post.ownerId);
    if (zaloId) {
      await this.zaloOaMessagingService.notifyTradePostApproved({
        zaloUserId: zaloId,
        title: post.title,
        summary: post.summary,
        imageUrl: post.thumbnailUrl,
        postId: post.id,
        slug: post.slug,
      });
    }

    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_APPROVED,
      'Tin đã được duyệt',
      `Tin "${excerpt(post.title, 80)}" đã được duyệt và hiển thị công khai.`,
    );
    // Only the first publication is news; re-approval after an edit is not.
    if (post.publishedAt === null) {
      await this.notifications.notifyAllUsers(
        {
          type: NotificationType.TRADE_POST_NEW,
          title:
            post.purpose === TradePostPurpose.NON_PROFIT
              ? 'Tin cộng đồng mới'
              : 'Tin giao thương mới',
          body: `${excerpt(post.title, 80)}: ${excerpt(post.summary, 120)}`,
          data: { tradePostId: post.id, slug: post.slug },
        },
        [post.ownerId],
      );
    }

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
    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_REJECTED,
      'Tin bị từ chối',
      `Tin "${excerpt(post.title, 80)}" bị từ chối: ${excerpt(reason, 200)}. Bạn có thể sửa và gửi lại.`,
      { reason },
    );
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
    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_ARCHIVED,
      'Tin đã được lưu trữ',
      `Tin "${excerpt(post.title, 80)}" đã được quản trị viên lưu trữ và không còn hiển thị công khai.`,
    );
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
    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_HIDDEN,
      'Tin bị ẩn',
      `Tin "${excerpt(post.title, 80)}" đã bị quản trị viên ẩn khỏi danh sách công khai.`,
    );
    return new TradePostEntity(updated);
  }

  async unhide(actorId: string, id: string): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    this.assertTransition(post.status, TradePostStatus.PUBLISHED);
    this.assertNotExpired(post);

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
    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_UNHIDDEN,
      'Tin hiển thị trở lại',
      `Tin "${excerpt(post.title, 80)}" đã được hiển thị công khai trở lại.`,
    );
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
    await this.notifyOwner(
      post,
      NotificationType.TRADE_POST_DELETED,
      'Tin bị xóa',
      `Tin "${excerpt(post.title, 80)}" đã bị quản trị viên xóa.`,
    );
  }

  async setFeatured(id: string, featured: boolean): Promise<TradePostEntity> {
    const post = await this.getActiveOrThrow(id);
    const updated = await this.tradePostRepository.update(id, { featured });
    if (featured && !post.featured) {
      await this.notifyOwner(
        post,
        NotificationType.TRADE_POST_FEATURED,
        'Tin được đưa lên nổi bật',
        `Tin "${excerpt(post.title, 80)}" đã được chọn hiển thị nổi bật.`,
      );
    }
    return new TradePostEntity(updated);
  }

  private notifyOwner(
    post: { id: string; slug: string; ownerId: string },
    type: NotificationType,
    title: string,
    body: string,
    data: { reason?: string } = {},
  ): Promise<void> {
    return this.notifications.notify(post.ownerId, {
      type,
      title,
      body,
      data: { tradePostId: post.id, slug: post.slug, ...data },
    });
  }

  private async assertPurposeAllowed(post: {
    ownerId: string;
    purpose: TradePostPurpose;
  }): Promise<void> {
    const owner = await this.userService.getProfile(post.ownerId);
    const businessType = owner.businessType ?? BusinessType.GENERAL;
    if (allowedPostPurposes(businessType).includes(post.purpose)) return;
    throw new AppException(
      ErrorCode.TRADE_POST_PURPOSE_NOT_ALLOWED,
      `Tài khoản ${BUSINESS_TYPE_CONFIG[businessType].label} không được đăng tin ${post.purpose === TradePostPurpose.NON_PROFIT ? 'phi lợi nhuận' : 'có lợi nhuận'}`,
      HttpStatus.FORBIDDEN,
    );
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

  /**
   * An expired post is filtered out of every public endpoint, so moving it to
   * PENDING/PUBLISHED would silently produce an invisible post.
   */
  private assertNotExpired(post: {
    expiresAt: Date | null;
    eventEndAt: Date | null;
  }): void {
    const expiry = effectiveExpiry(post);
    if (expiry && expiry.getTime() <= Date.now()) {
      throw new AppException(
        ErrorCode.TRADE_POST_EXPIRED,
        'Tin đã quá ngày hết hạn nên sẽ không hiển thị công khai. Cần cập nhật ngày hết hạn trước.',
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
