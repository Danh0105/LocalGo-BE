import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma';
import { RequestContextService } from '../../../common/context/request-context.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { redactAuditData } from '../utils/redact-audit-data.util';

export interface AuditLogWriteParams {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}

/**
 * Write-only in Phase 1 (no read/dashboard API yet — see docs/assumptions.md).
 * Audit writes must never block or fail the business operation they describe;
 * failures are logged, not thrown.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly requestContext: RequestContextService,
  ) {}

  async write(params: AuditLogWriteParams): Promise<void> {
    const context = this.requestContext.get();
    try {
      await this.auditLogRepository.create({
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        oldData: redactAuditData(params.oldData) as
          Prisma.InputJsonValue | undefined,
        newData: redactAuditData(params.newData) as
          Prisma.InputJsonValue | undefined,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        requestId: context?.requestId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action=${params.action} resourceType=${params.resourceType}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
