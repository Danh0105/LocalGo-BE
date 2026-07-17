export interface UploadMediaInput {
  storageKey: string;
  thumbnailKey: string;
  originalBuffer: Buffer;
  thumbnailBuffer: Buffer;
  mimeType: string;
}

export interface StoredMedia {
  storageKey: string;
  originalUrl: string;
  thumbnailUrl: string;
}

export interface MediaStorageService {
  upload(input: UploadMediaInput): Promise<StoredMedia>;
  delete(storageKey: string, thumbnailKey?: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
