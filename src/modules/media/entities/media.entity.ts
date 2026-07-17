import type { Media, MediaResourceType } from '../../../../generated/prisma';

/**
 * Domain-shape mapper: DB row -> safe internal object. Deliberately
 * excludes ownerId, storageProvider, storageKey and checksum — internal
 * bookkeeping never returned to a client.
 */
export class MediaEntity {
  id: string;
  originalUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  resourceType: MediaResourceType | null;
  resourceId: string | null;
  createdAt: Date;

  constructor(media: Media) {
    this.id = media.id;
    this.originalUrl = media.originalUrl;
    this.thumbnailUrl = media.thumbnailUrl;
    this.mimeType = media.mimeType;
    this.size = media.size;
    this.width = media.width;
    this.height = media.height;
    this.resourceType = media.resourceType;
    this.resourceId = media.resourceId;
    this.createdAt = media.createdAt;
  }
}
