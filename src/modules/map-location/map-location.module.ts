import { Global, Module } from '@nestjs/common';
import { GoogleMapResolverService } from './google-map-resolver.service';
import { MapLocationMaintenanceService } from './map-location-maintenance.service';
import { MapLocationService } from './map-location.service';
import { MapLocationWorkerService } from './map-location-worker.service';
import { SafeGoogleRedirectService } from './safe-google-redirect.service';

@Global()
@Module({
  providers: [
    MapLocationService,
    SafeGoogleRedirectService,
    GoogleMapResolverService,
    MapLocationWorkerService,
    MapLocationMaintenanceService,
  ],
  exports: [MapLocationService, MapLocationMaintenanceService],
})
export class MapLocationModule {}
