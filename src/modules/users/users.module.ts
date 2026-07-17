import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UsersAdminController } from './controllers/users-admin.controller';
import { UserAdminService } from './services/user-admin.service';

@Module({
  controllers: [UsersController, UsersAdminController],
  providers: [UserRepository, UserService, UserAdminService],
  exports: [UserService],
})
export class UsersModule {}
