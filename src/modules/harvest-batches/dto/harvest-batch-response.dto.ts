import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HarvestBatch } from '../../../../generated/prisma';
import { fromDateColumn } from '../harvest-batch.constants';
import type {
  HarvestBatchRecord,
  HarvestTraceRecord,
} from '../repositories/harvest-batch.repository';

function totalPrice(batch: HarvestBatch): number {
  return Math.round(Number(batch.weightKg) * Number(batch.pricePerKg));
}

export class HarvestBatchImageResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) width: number | null;
  @ApiPropertyOptional({ nullable: true }) height: number | null;
  @ApiProperty() sortOrder: number;
}

export class HarvestTraceImageResponseDto {
  @ApiProperty() url: string;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) width: number | null;
  @ApiPropertyOptional({ nullable: true }) height: number | null;
  @ApiProperty() sortOrder: number;
}

/** A batch as its owner manages it in the seller center. */
export class HarvestBatchResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({
    example: 'K7M2Q9XA',
    description: 'Mã công khai in trên tem QR.',
  })
  code: string;
  @ApiProperty() ownerName: string;
  @ApiProperty() fruitName: string;
  @ApiProperty({ example: '2026-10-21' }) harvestDate: string;
  @ApiProperty({ example: 12.5 }) weightKg: number;
  @ApiProperty({ example: 85000 }) pricePerKg: number;
  @ApiProperty({
    example: 1062500,
    description: 'weightKg × pricePerKg, làm tròn đến đồng.',
  })
  totalPrice: number;
  @ApiProperty() fertilizers: string;
  @ApiProperty() pesticides: string;
  @ApiProperty({ type: [HarvestBatchImageResponseDto] })
  images: HarvestBatchImageResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromRecord(batch: HarvestBatchRecord): HarvestBatchResponseDto {
    const dto = new HarvestBatchResponseDto();
    dto.id = batch.id;
    dto.code = batch.code;
    dto.ownerName = batch.ownerName;
    dto.fruitName = batch.fruitName;
    dto.harvestDate = fromDateColumn(batch.harvestDate);
    dto.weightKg = Number(batch.weightKg);
    dto.pricePerKg = Number(batch.pricePerKg);
    dto.totalPrice = totalPrice(batch);
    dto.fertilizers = batch.fertilizers;
    dto.pesticides = batch.pesticides;
    dto.images = batch.images.map((image) => ({
      id: image.mediaId,
      url: image.media.originalUrl,
      thumbnailUrl: image.media.thumbnailUrl,
      width: image.media.width,
      height: image.media.height,
      sortOrder: image.sortOrder,
    }));
    dto.createdAt = batch.createdAt;
    dto.updatedAt = batch.updatedAt;
    return dto;
  }
}

/** What anyone scanning the QR label sees. No internal ids. */
export class HarvestTraceResponseDto {
  @ApiProperty() code: string;
  @ApiProperty({
    description: 'Tên tài khoản nhà vườn đã được duyệt trên LocalGo.',
  })
  gardenName: string;
  @ApiProperty() ownerName: string;
  @ApiProperty() fruitName: string;
  @ApiProperty({ example: '2026-10-21' }) harvestDate: string;
  @ApiProperty() weightKg: number;
  @ApiProperty() pricePerKg: number;
  @ApiProperty() totalPrice: number;
  @ApiProperty() fertilizers: string;
  @ApiProperty() pesticides: string;
  @ApiProperty({ type: [HarvestTraceImageResponseDto] })
  images: HarvestTraceImageResponseDto[];
  @ApiProperty({ description: 'Lần cập nhật khai báo gần nhất.' })
  declaredAt: Date;

  static fromRecord(batch: HarvestTraceRecord): HarvestTraceResponseDto {
    const dto = new HarvestTraceResponseDto();
    dto.code = batch.code;
    dto.gardenName = batch.owner.displayName;
    dto.ownerName = batch.ownerName;
    dto.fruitName = batch.fruitName;
    dto.harvestDate = fromDateColumn(batch.harvestDate);
    dto.weightKg = Number(batch.weightKg);
    dto.pricePerKg = Number(batch.pricePerKg);
    dto.totalPrice = totalPrice(batch);
    dto.fertilizers = batch.fertilizers;
    dto.pesticides = batch.pesticides;
    dto.images = batch.images.map((image) => ({
      url: image.media.originalUrl,
      thumbnailUrl: image.media.thumbnailUrl,
      width: image.media.width,
      height: image.media.height,
      sortOrder: image.sortOrder,
    }));
    dto.declaredAt = batch.updatedAt;
    return dto;
  }
}
