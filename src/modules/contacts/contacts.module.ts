import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ContactsAdminController } from './controllers/contacts-admin.controller';
import { ContactsController } from './controllers/contacts.controller';
import { ContactService } from './services/contact.service';

@Module({
  imports: [MediaModule],
  controllers: [ContactsController, ContactsAdminController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactsModule {}
