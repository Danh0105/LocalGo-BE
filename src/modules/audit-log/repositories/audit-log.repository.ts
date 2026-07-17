import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }
}
