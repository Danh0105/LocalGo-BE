import { Injectable } from '@nestjs/common';
import type { Media, Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MediaUncheckedCreateInput): Promise<Media> {
    return this.prisma.media.create({ data });
  }

  findById(id: string): Promise<Media | null> {
    return this.prisma.media.findFirst({ where: { id, deletedAt: null } });
  }

  findByIds(ids: string[]): Promise<Media[]> {
    return this.prisma.media.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  /** Ignores deletedAt — used to resolve storageKeys after media rows have already been soft-deleted. */
  findRawByIds(ids: string[]): Promise<Media[]> {
    return this.prisma.media.findMany({ where: { id: { in: ids } } });
  }
}
