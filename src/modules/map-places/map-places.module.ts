import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { MapPlacesAdminController } from './controllers/map-places-admin.controller';
import { MapPlacesController } from './controllers/map-places.controller';
import { MapPlaceService } from './services/map-place.service';

@Module({
  imports: [MediaModule],
  controllers: [MapPlacesController, MapPlacesAdminController],
  providers: [MapPlaceService],
  exports: [MapPlaceService],
})
export class MapPlacesModule {}
