/**
 * Kinds of bell notifications. Stored as plain strings (Notification.type) so
 * adding one needs no migration; the mini app maps each type to a screen
 * using the ids in `data` (see docs/notifications-api.md).
 */
export const NotificationType = {
  /** Staff notification when a user submits or resubmits a business profile. */
  BUSINESS_APPLICATION_SUBMITTED: 'BUSINESS_APPLICATION_SUBMITTED',
  BUSINESS_APPLICATION_APPROVED: 'BUSINESS_APPLICATION_APPROVED',
  BUSINESS_APPLICATION_REJECTED: 'BUSINESS_APPLICATION_REJECTED',
  /** Staff notification when a trade post enters the moderation queue. */
  TRADE_POST_SUBMITTED: 'TRADE_POST_SUBMITTED',
  /** Broadcast to every mini app user when a post is published for the first time. */
  TRADE_POST_NEW: 'TRADE_POST_NEW',
  TRADE_POST_APPROVED: 'TRADE_POST_APPROVED',
  TRADE_POST_REJECTED: 'TRADE_POST_REJECTED',
  TRADE_POST_HIDDEN: 'TRADE_POST_HIDDEN',
  TRADE_POST_UNHIDDEN: 'TRADE_POST_UNHIDDEN',
  TRADE_POST_ARCHIVED: 'TRADE_POST_ARCHIVED',
  TRADE_POST_DELETED: 'TRADE_POST_DELETED',
  TRADE_POST_FEATURED: 'TRADE_POST_FEATURED',
  TRADE_POST_SAVED: 'TRADE_POST_SAVED',
  TRADE_REVIEW_RECEIVED: 'TRADE_REVIEW_RECEIVED',
  /** Staff notification for a newly published, post-moderated trade review. */
  TRADE_REVIEW_SUBMITTED: 'TRADE_REVIEW_SUBMITTED',
  TRADE_REVIEW_APPROVED: 'TRADE_REVIEW_APPROVED',
  TRADE_REVIEW_HIDDEN: 'TRADE_REVIEW_HIDDEN',
  TRADE_REVIEW_DELETED: 'TRADE_REVIEW_DELETED',
  TRADE_REVIEW_REPLIED: 'TRADE_REVIEW_REPLIED',
  /** Content (temple, festival, ...) reviews — data: reviewId, targetType, targetId. */
  CONTENT_REVIEW_SUBMITTED: 'CONTENT_REVIEW_SUBMITTED',
  CONTENT_REVIEW_HIDDEN: 'CONTENT_REVIEW_HIDDEN',
  CONTENT_REVIEW_UNHIDDEN: 'CONTENT_REVIEW_UNHIDDEN',
  CONTENT_REVIEW_DELETED: 'CONTENT_REVIEW_DELETED',
  CONTENT_REVIEW_REPLIED: 'CONTENT_REVIEW_REPLIED',
  TRADE_CONVERSATION_STARTED: 'TRADE_CONVERSATION_STARTED',
  /** Staff notification when a garden owner declares a traceable batch. */
  HARVEST_BATCH_SUBMITTED: 'HARVEST_BATCH_SUBMITTED',
  FEEDBACK_MESSAGE_RECEIVED: 'FEEDBACK_MESSAGE_RECEIVED',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const TradePostNotificationTarget = {
  PUBLIC_DETAIL: 'PUBLIC_DETAIL',
  OWNER_MANAGE: 'OWNER_MANAGE',
  ADMIN_MANAGE: 'ADMIN_MANAGE',
} as const;

export type TradePostNotificationTarget =
  (typeof TradePostNotificationTarget)[keyof typeof TradePostNotificationTarget];

export const TradePostUnavailableReason = {
  NOT_FOUND: 'NOT_FOUND',
  DELETED: 'DELETED',
  NOT_PUBLIC: 'NOT_PUBLIC',
} as const;

export type TradePostUnavailableReason =
  (typeof TradePostUnavailableReason)[keyof typeof TradePostUnavailableReason];

/** Ids the mini app needs to open the related screen. */
export interface NotificationData {
  applicationId?: string;
  tradePostId?: string;
  /** Legacy field retained for Mini App backwards compatibility. */
  slug?: string;
  /** Canonical current slug resolved from TradePost by tradePostId. */
  tradePostSlug?: string;
  tradePostTarget?: TradePostNotificationTarget;
  tradePostAvailable?: boolean;
  tradePostUnavailableReason?: TradePostUnavailableReason;
  tradePostStatus?: string;
  reviewId?: string;
  /** Content review section (`temples`, `festivals`, ...) and item id. */
  targetType?: string;
  targetId?: string;
  conversationId?: string;
  feedbackTicketId?: string;
  feedbackMessageId?: string;
  ticketCode?: string;
  harvestBatchId?: string;
  harvestCode?: string;
  submittedById?: string;
  reason?: string;
}

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

/** Socket.IO events emitted on the /notifications namespace. */
export const NotificationSocketEvent = {
  /** A new bell notification: { notification, unreadCount } */
  NEW: 'notification.new',
  /** Unread count changed (read / read-all, or on connect): { unreadCount } */
  UNREAD_COUNT: 'notification.unread_count',
  /** Realtime chat message for the other participant: { conversationId, tradePostId, message } */
  CHAT_MESSAGE: 'chat.message',
} as const;

/** Trims user text for a notification body. */
export function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
