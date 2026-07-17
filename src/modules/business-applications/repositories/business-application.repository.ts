import { Injectable } from '@nestjs/common';
import type {
  BusinessApplicantType,
  BusinessApplicationStatus,
  Prisma,
} from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

export const BUSINESS_APPLICATION_INCLUDE = {
  documents: { include: { media: true }, orderBy: { createdAt: 'asc' } },
  reviewedBy: { select: { displayName: true } },
} satisfies Prisma.BusinessApplicationInclude;

export type BusinessApplicationRecord = Prisma.BusinessApplicationGetPayload<{
  include: typeof BUSINESS_APPLICATION_INCLUDE;
}>;

@Injectable()
export class BusinessApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<BusinessApplicationRecord | null> {
    return this.prisma.businessApplication.findUnique({
      where: { id },
      include: BUSINESS_APPLICATION_INCLUDE,
    });
  }

  findLatestForUser(userId: string): Promise<BusinessApplicationRecord | null> {
    return this.prisma.businessApplication.findFirst({
      where: { submittedById: userId },
      orderBy: { createdAt: 'desc' },
      include: BUSINESS_APPLICATION_INCLUDE,
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    status?: BusinessApplicationStatus;
    applicantType?: BusinessApplicantType;
    search?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: BusinessApplicationRecord[]; total: number }> {
    const where: Prisma.BusinessApplicationWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.applicantType ? { applicantType: params.applicantType } : {}),
      ...(params.search
        ? {
            OR: [
              {
                businessName: { contains: params.search, mode: 'insensitive' },
              },
              { contactName: { contains: params.search, mode: 'insensitive' } },
              {
                contactEmail: { contains: params.search, mode: 'insensitive' },
              },
              {
                contactPhone: { contains: params.search, mode: 'insensitive' },
              },
              { taxCode: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortOrder = params.sortOrder ?? 'desc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessApplication.findMany({
        where,
        include: BUSINESS_APPLICATION_INCLUDE,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.businessApplication.count({ where }),
    ]);
    return { items, total };
  }
}
