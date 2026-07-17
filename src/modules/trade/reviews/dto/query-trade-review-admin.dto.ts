import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TradeReviewStatus } from '../../../../../generated/prisma';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class QueryTradeReviewAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TradeReviewStatus })
  @IsOptional()
  @IsEnum(TradeReviewStatus)
  status?: TradeReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tradePostId?: string;
}
