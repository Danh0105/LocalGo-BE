import { Injectable } from '@nestjs/common';
import type { AboutPage, Media } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AboutRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPage(): Promise<AboutPage | null> {
    return this.prisma.aboutPage.findUnique({ where: { id: 'about' } });
  }

  findMedia(ids: string[]): Promise<Media[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.media.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }
}
