import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { HarvestTraceResponseDto } from '../dto/harvest-batch-response.dto';
import { HarvestBatchService } from '../services/harvest-batch.service';

/** What a phone shows after scanning a garden's QR label. */
@ApiTags('harvest-batches')
@Controller('harvest-trace')
export class HarvestTraceController {
  constructor(private readonly service: HarvestBatchService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tra cứu lô hàng theo mã trên tem QR (công khai)',
    description:
      'Không phân biệt hoa thường. Lô đã xóa hoặc chủ vườn bị khóa → 404 HARVEST_BATCH_NOT_FOUND.',
  })
  @Get(':code')
  trace(@Param('code') code: string): Promise<HarvestTraceResponseDto> {
    return this.service.trace(code);
  }
}
