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
  ReorderMapPlacesDto,
  UpdateMapPlaceStatusDto,
} from '../dto/map-place-action.dto';
import { QueryMapPlaceAdminDto } from '../dto/query-map-place.dto';
import { MapPlaceAdminResponseDto } from '../dto/map-place-response.dto';
import {
  CreateMapPlaceDto,
  UpdateMapPlaceDto,
} from '../dto/upsert-map-place.dto';
import { MapPlaceService } from '../services/map-place.service';

@ApiTags('admin-map-places')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/map-places')
export class MapPlacesAdminController {
  constructor(private readonly service: MapPlaceService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ điểm bản đồ' })
  @ApiResponse({ status: 200, type: [MapPlaceAdminResponseDto] })
  list(@Query() query: QueryMapPlaceAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết điểm bản đồ' })
  @ApiResponse({ status: 200, type: MapPlaceAdminResponseDto })
  detail(@Param('id') id: string): Promise<MapPlaceAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo điểm bản đồ' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMapPlaceDto,
  ): Promise<MapPlaceAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'MAP_PLACE_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMapPlaceDto,
  ): Promise<MapPlaceAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều điểm bản đồ trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderMapPlacesDto,
  ): Promise<MapPlaceAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện điểm bản đồ' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMapPlaceStatusDto,
  ): Promise<MapPlaceAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa điểm bản đồ' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}
