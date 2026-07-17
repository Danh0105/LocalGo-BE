import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import {
  ReorderCraftVillagesDto,
  UpdateCraftVillageStatusDto,
} from '../dto/craft-village-action.dto';
import { QueryCraftVillageAdminDto } from '../dto/query-craft-village.dto';
import { CraftVillageAdminResponseDto } from '../dto/craft-village-response.dto';
import {
  CreateCraftVillageDto,
  UpdateCraftVillageDto,
} from '../dto/upsert-craft-village.dto';
import { CraftVillageService } from '../services/craft-village.service';

@ApiTags('admin-craft-villages')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/craft-villages')
export class CraftVillagesAdminController {
  constructor(private readonly service: CraftVillageService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ làng nghề' })
  @ApiResponse({ status: 200, type: [CraftVillageAdminResponseDto] })
  list(@Query() query: QueryCraftVillageAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết làng nghề' })
  @ApiResponse({ status: 200, type: CraftVillageAdminResponseDto })
  detail(@Param('id') id: string): Promise<CraftVillageAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo làng nghề' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCraftVillageDto,
  ): Promise<CraftVillageAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'CRAFT_VILLAGE_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCraftVillageDto,
  ): Promise<CraftVillageAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều làng nghề trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderCraftVillagesDto,
  ): Promise<CraftVillageAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện làng nghề' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCraftVillageStatusDto,
  ): Promise<CraftVillageAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa làng nghề' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}
