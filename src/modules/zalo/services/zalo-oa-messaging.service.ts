import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZaloOaConfig } from '../../../config/zalo-oa.config';

export interface TradePostApprovedNotification {
  zaloUserId: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  postId: string;
  slug: string;
}

/**
 * Zalo's OA Graph API always includes `error`/`message` in the response body
 * — success is `error: 0`, not the absence of the key — mirrors the same
 * quirk RealZaloAuthProvider already works around for graph.zalo.me/v2.0/me.
 */
interface ZaloOaSendResponse {
  error?: number;
  message?: string;
}

/**
 * Best-effort push to a user's Zalo Mini App session via the OA linked to
 * the Mini App. Never throws — a failed/unsent notification must not block
 * the trade-post approval it's attached to; callers just fire-and-forget.
 * Self-disables (logs + no-ops) until ZALO_OA_ACCESS_TOKEN is configured.
 */
@Injectable()
export class ZaloOaMessagingService {
  private readonly logger = new Logger(ZaloOaMessagingService.name);
  private readonly config: ZaloOaConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<ZaloOaConfig>('zaloOa');
  }

  async notifyTradePostApproved(
    input: TradePostApprovedNotification,
  ): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug(
        `Bỏ qua thông báo Zalo OA (chưa cấu hình ZALO_OA_ACCESS_TOKEN): tin ${input.postId}`,
      );
      return;
    }

    const deepLink = this.buildDeepLink(input.slug, input.postId);
    const url = new URL('/v3.0/oa/message/cs', this.config.apiBaseUrl);

    const elements = [
      {
        title: input.title,
        subtitle: input.summary,
        image_url: input.imageUrl ?? undefined,
        default_action: deepLink
          ? { type: 'oa.open.url', url: deepLink }
          : undefined,
      },
    ];

    const body = {
      recipient: { user_id: input.zaloUserId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'list',
            elements,
            ...(deepLink
              ? {
                  buttons: [
                    {
                      title: 'Xem tin đăng',
                      type: 'oa.open.url',
                      payload: { url: deepLink },
                    },
                  ],
                }
              : {}),
          },
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.config.accessToken ?? '',
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ZaloOaSendResponse;
      if (!response.ok || result.error) {
        this.logger.error(
          `Gửi thông báo Zalo OA thất bại cho tin ${input.postId}: ${result.message ?? response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Không thể kết nối Zalo OA API khi thông báo duyệt tin ${input.postId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildDeepLink(slug: string, postId: string): string | undefined {
    if (!this.config.miniAppId) {
      return undefined;
    }
    const link = new URL(
      `https://zalo.me/s/${this.config.miniAppId}/${this.config.miniAppDeepLinkPath}/${slug}`,
    );
    link.searchParams.set('id', postId);
    return link.toString();
  }
}
