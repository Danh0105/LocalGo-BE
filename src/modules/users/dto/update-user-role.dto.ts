import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserRole } from '../../../../generated/prisma';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsIn(Object.values(UserRole))
  role: UserRole;
}
