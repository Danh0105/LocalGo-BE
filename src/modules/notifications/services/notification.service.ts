import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, type Notification } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import type { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import { NotificationResponseDto } from '../dto/notification.dto';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import {
  NotificationSocketEvent,
  NotificationType,
  TradePostNotificationTarget,
  TradePostUnavailableReason,
  type NotificationData,
  type NotificationInput,
  type TradePostNotificationTarget as TradePostTarget,
} from '../notification-types';
import {
  NotificationRepository,
  type NotificationTradePostTarget,
} from '../repositories/notification.repository';

/** Fan-out batch size for broadcasts (one createMany per batch). */
const BROADCAST_BATCH = 500;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Stores a bell notification for each recipient and pushes it over the
   * socket. Never throws: a notification failure must not undo or fail the
   * business action that triggered it, so call it after that action succeeded.
   */
  async notify(
    recipients: string | null | undefined | (string | null | undefined)[],
    input: NotificationInput,
  ): Promise<void> {
    const userIds = [
      ...new Set(
        (Array.isArray(recipients) ? recipients : [recipients]).filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        ),
      ),
    ];
    if (userIds.length === 0) return;

    try {
      const resolvedInput = await this.resolveInput(input);
      const created = await this.repository.createForUsers(
        userIds,
        resolvedInput,
      );
      const unread = await this.repository.countUnreadByUser(userIds);
      for (const notification of created) {
        this.gateway.emitToUser(
          notification.userId,
          NotificationSocketEvent.NEW,
          {
            notification: NotificationResponseDto.fromRecord(notification),
            unreadCount: unread.get(notification.userId) ?? 0,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Không gửi được thông báo ${input.type} cho ${userIds.length} người dùng`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Notifies every mini app user (USER/BUSINESS, active), except `excludeUserIds`. */
  async notifyAllUsers(
    input: NotificationInput,
    excludeUserIds: string[] = [],
  ): Promise<void> {
    try {
      const audience =
        await this.repository.findBroadcastAudience(excludeUserIds);
      for (let i = 0; i < audience.length; i += BROADCAST_BATCH) {
        await this.notify(audience.slice(i, i + BROADCAST_BATCH), input);
      }
    } catch (error) {
      this.logger.error(
        `Không gửi được thông báo ${input.type} tới toàn bộ người dùng`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Notifies every active ADMIN/MODERATOR, except `excludeUserIds`. */
  async notifyStaff(
    input: NotificationInput,
    excludeUserIds: string[] = [],
  ): Promise<void> {
    try {
      const audience = await this.repository.findStaffAudience(excludeUserIds);
      await this.notify(audience, input);
    } catch (error) {
      this.logger.error(
        `Không gửi được thông báo ${input.type} tới quản trị viên`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Backwards-compatible semantic alias for feedback conversations. */
  notifyFeedbackStaff(
    input: NotificationInput,
    excludeUserIds: string[] = [],
  ): Promise<void> {
    return this.notifyStaff(input, excludeUserIds);
  }

  /** Pushes a socket-only event (no bell row), e.g. a live chat message. */
  emit(userId: string, event: string, payload: unknown): void {
    this.gateway.emitToUser(userId, event, payload);
  }

  async list(
    userId: string,
    page: number,
    limit: number,
    unreadOnly = false,
  ): Promise<PaginatedResultDto<NotificationResponseDto>> {
    const { skip, take } = buildPaginationArgs(page, limit);
    const { items, total } = await this.repository.findPage({
      userId,
      unreadOnly,
      skip,
      take,
    });
    const resolved = await this.resolveRecords(items);
    return paginate(resolved, page, limit, total);
  }

  async get(userId: string, id: string): Promise<NotificationResponseDto> {
    const item = await this.repository.findOwnedById(userId, id);
    if (!item) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy thông báo',
        HttpStatus.NOT_FOUND,
      );
    }
    return (await this.resolveRecords([item]))[0];
  }

  unreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<void> {
    const found = await this.repository.markRead(userId, id);
    if (!found) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy thông báo',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.syncUnreadCount(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId);
    await this.syncUnreadCount(userId);
  }

  /** Keeps the badge in step on the user's other devices. */
  private async syncUnreadCount(userId: string): Promise<void> {
    this.gateway.emitToUser(userId, NotificationSocketEvent.UNREAD_COUNT, {
      unreadCount: await this.repository.countUnread(userId),
    });
  }

  private async resolveInput(
    input: NotificationInput,
  ): Promise<NotificationInput> {
    if (!input.data?.tradePostId) return input;
    const posts = await this.repository.findTradePostTargets([
      input.data.tradePostId,
    ]);
    return {
      ...input,
      data: this.resolveTradePostData(
        input.type,
        input.data,
        posts.get(input.data.tradePostId),
      ),
    };
  }

  /**
   * Resolves legacy rows on read and persists the corrected payload. This
   * means a stored old slug follows the current TradePost.slug by its stable
   * id, while deleted/missing posts become explicitly non-navigable.
   */
  private async resolveRecords(
    records: Notification[],
  ): Promise<NotificationResponseDto[]> {
    const ids = [
      ...new Set(
        records
          .map((record) => this.asData(record.data)?.tradePostId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const posts = await this.repository.findTradePostTargets(ids);
    const updates: Array<{ id: string; data: Prisma.InputJsonValue }> = [];
    const responses = records.map((record) => {
      const current = this.asData(record.data);
      if (!current?.tradePostId) {
        return NotificationResponseDto.fromRecord(record);
      }
      const resolved = this.resolveTradePostData(
        record.type,
        current,
        posts.get(current.tradePostId),
      );
      if (JSON.stringify(current) !== JSON.stringify(resolved)) {
        updates.push({
          id: record.id,
          data: resolved as Prisma.InputJsonValue,
        });
      }
      return NotificationResponseDto.fromRecord(record, resolved);
    });
    // The response is already correct even if this best-effort backfill fails.
    try {
      await this.repository.updateResolvedData(updates);
    } catch (error) {
      this.logger.warn(
        `Không cập nhật được ${updates.length} payload thông báo cũ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return responses;
  }

  private resolveTradePostData(
    type: string,
    data: NotificationData,
    post: NotificationTradePostTarget | undefined,
  ): NotificationData {
    // The notification kind, not legacy JSON, is the source of truth for the
    // destination. This also repairs old rows that carried a wrong target.
    const target = this.targetForType(type);
    if (!post) {
      const resolved: NotificationData = {
        ...data,
        tradePostTarget: target,
        tradePostAvailable: false,
        tradePostUnavailableReason: TradePostUnavailableReason.NOT_FOUND,
      };
      delete resolved.slug;
      delete resolved.tradePostSlug;
      delete resolved.tradePostStatus;
      return resolved;
    }

    const publicAvailable = this.isPubliclyAvailable(post);
    const available =
      target === TradePostNotificationTarget.PUBLIC_DETAIL
        ? publicAvailable
        : post.deletedAt === null;
    const resolved: NotificationData = {
      ...data,
      tradePostId: post.id,
      // Keep both during the compatibility window. Neither is URL-encoded.
      slug: post.slug,
      tradePostSlug: post.slug,
      tradePostTarget: target,
      tradePostAvailable: available,
      tradePostStatus: post.status,
    };
    if (available) {
      delete resolved.tradePostUnavailableReason;
    } else {
      resolved.tradePostUnavailableReason = post.deletedAt
        ? TradePostUnavailableReason.DELETED
        : TradePostUnavailableReason.NOT_PUBLIC;
    }
    return resolved;
  }

  private isPubliclyAvailable(post: NotificationTradePostTarget): boolean {
    const expiry = post.expiresAt ?? post.eventEndAt;
    return (
      post.deletedAt === null &&
      post.status === 'PUBLISHED' &&
      post.category.isActive &&
      post.category.deletedAt === null &&
      (expiry === null || expiry.getTime() > Date.now())
    );
  }

  private targetForType(type: string): TradePostTarget {
    switch (type) {
      case NotificationType.TRADE_POST_NEW:
      case NotificationType.TRADE_REVIEW_APPROVED:
      case NotificationType.TRADE_REVIEW_HIDDEN:
      case NotificationType.TRADE_REVIEW_DELETED:
      case NotificationType.TRADE_REVIEW_REPLIED:
        return TradePostNotificationTarget.PUBLIC_DETAIL;
      case NotificationType.TRADE_POST_SUBMITTED:
      case NotificationType.TRADE_REVIEW_SUBMITTED:
        return TradePostNotificationTarget.ADMIN_MANAGE;
      default:
        return TradePostNotificationTarget.OWNER_MANAGE;
    }
  }

  private asData(value: Prisma.JsonValue | null): NotificationData | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null;
  }
}
