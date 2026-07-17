import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserStatus } from '../../../../generated/prisma';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: [UserStatus.ACTIVE, UserStatus.BLOCKED] })
  @IsIn([UserStatus.ACTIVE, UserStatus.BLOCKED])
  status: UserStatus;
}
