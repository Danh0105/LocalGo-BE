import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { HarvestBatchResponseDto } from '../dto/harvest-batch-response.dto';
import { QueryHarvestBatchesDto } from '../dto/query-harvest-batches.dto';
import {
  CreateHarvestBatchDto,
  UpdateHarvestBatchDto,
} from '../dto/upsert-harvest-batch.dto';
import { GardenOwnerGuard } from '../guards/garden-owner.guard';
import { HarvestBatchService } from '../services/harvest-batch.service';

/** Garden owners declare harvest batches here and print QR labels for them. */
@ApiTags('harvest-batches')
@ApiBearerAuth()
@UseGuards(GardenOwnerGuard)
@Controller('harvest-batches')
export class HarvestBatchesController {
  constructor(private readonly service: HarvestBatchService) {}

  @ApiOperation({
    summary: 'Lô hàng của tôi (mới cắt trước)',
    description:
      'Chỉ cho tài khoản BUSINESS ACTIVE loại GARDEN. Loại khác → 403 GARDEN_ACCOUNT_REQUIRED.',
  })
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryHarvestBatchesDto,
  ): Promise<{ data: HarvestBatchResponseDto[]; meta: unknown }> {
    const result = await this.service.list(user, query);
    return { data: result.data, meta: result.meta };
  }

  @ApiOperation({ summary: 'Khai báo lô hàng mới (sinh mã QR)' })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHarvestBatchDto,
  ): Promise<HarvestBatchResponseDto> {
    return this.service.create(user, dto);
  }

  @ApiOperation({ summary: 'Chi tiết một lô hàng của tôi' })
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HarvestBatchResponseDto> {
    return this.service.get(user, id);
  }

  @ApiOperation({
    summary: 'Sửa khai báo lô hàng',
    description: 'Mã QR giữ nguyên, tem đã in hiển thị thông tin mới.',
  })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHarvestBatchDto,
  ): Promise<HarvestBatchResponseDto> {
    return this.service.update(user, id, dto);
  }

  @ApiOperation({
    summary: 'Xóa lô hàng',
    description: 'Xóa mềm; quét tem của lô này sẽ trả 404.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
