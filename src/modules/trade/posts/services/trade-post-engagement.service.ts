import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TradePostEventType } from '../../../../../generated/prisma';
import { RequestContextService } from '../../../../common/context/request-context.service';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import type { AppConfig } from '../../../../config/app.config';
import type { TradePostInteractionType } from '../../trade.constants';
import { TradePostEventRepository } from '../repositories/trade-post-event.repository';
import { TradePostRepository } from '../repositories/trade-post.repository';
import { computeVisitorHash } from '../utils/visitor-hash.util';

/**
 * Owns the analytics write path: turning a page view or an explicit
 * interaction into a `TradePostEvent`. The anonymous visitor fingerprint is
 * derived here from the ambient request context (ip + user-agent) so callers
 * never have to thread the raw request through.
 */
@Injectable()
export class TradePostEngagementService {
  private readonly logger = new Logger(TradePostEngagementService.name);
  private readonly hashSecret: string;

  constructor(
    private readonly eventRepository: TradePostEventRepository,
    private readonly tradePostRepository: TradePostRepository,
    private readonly requestContext: RequestContextService,
    configService: ConfigService,
  ) {
    this.hashSecret =
      configService.getOrThrow<AppConfig>('app').analyticsHashSecret;
  }

  /**
   * Records a VIEW event. Best-effort: analytics must never break the
   * user-facing read, so any failure is logged and swallowed.
   */
  async recordView(tradePostId: string, userId?: string | null): Promise<void> {
    try {
      await this.eventRepository.record({
        tradePostId,
        type: TradePostEventType.VIEW,
        userId: userId ?? null,
        visitorHash: this.currentVisitorHash(),
      });
    } catch (error) {
      this.logger.warn(
        `Không ghi được sự kiện VIEW cho tin ${tradePostId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Records an explicit interaction (contact/zalo/share) against a currently
   * viewable post. Unlike views, a bad target here is a client error, so this
   * throws 404 when the post is not publicly viewable.
   */
  async recordInteraction(
    idOrSlug: string,
    type: TradePostInteractionType,
    userId?: string | null,
  ): Promise<void> {
    const post =
      await this.tradePostRepository.findViewableIdBySlugOrId(idOrSlug);
    if (!post) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tin đăng',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.eventRepository.record({
      tradePostId: post.id,
      type,
      userId: userId ?? null,
      visitorHash: this.currentVisitorHash(),
    });
  }

  private currentVisitorHash(): string | null {
    const context = this.requestContext.get();
    return computeVisitorHash(
      this.hashSecret,
      context?.ipAddress,
      context?.userAgent,
    );
  }
}
