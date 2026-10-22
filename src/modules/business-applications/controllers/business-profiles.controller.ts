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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BusinessProfileResponseDto } from '../dto/business-profile-response.dto';
import { QueryBusinessProfilesDto } from '../dto/query-business-profiles.dto';
import {
  CreateBusinessProfileDto,
  UpdateBusinessProfileDto,
} from '../dto/upsert-business-profile.dto';
import { BusinessProfileService } from '../services/business-profile.service';

@ApiTags('business-profiles')
@ApiBearerAuth()
@Controller('business-profiles')
export class BusinessProfilesController {
  constructor(private readonly service: BusinessProfileService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ doanh nghiệp đang công khai' })
  async list(@Query() query: QueryBusinessProfilesDto) {
    const result = await this.service.listPublic(query);
    return {
      data: result.data.map((item) =>
        BusinessProfileResponseDto.fromRecord(item),
      ),
      meta: result.meta,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hồ sơ cho tài khoản BUSINESS hiện tại' })
  @ApiResponse({ status: 201, type: BusinessProfileResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessProfileDto,
  ) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.createMine(user.id, dto),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy hồ sơ doanh nghiệp của tài khoản hiện tại' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.getMine(user.id),
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ doanh nghiệp hiện tại' })
  async updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.updateMine(user.id, dto),
    );
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mềm hồ sơ doanh nghiệp hiện tại' })
  async deleteMine(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.deleteMine(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết hồ sơ công khai theo profile ID hoặc user ID',
  })
  async getPublic(@Param('id') id: string) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.getPublic(id),
    );
  }
}
