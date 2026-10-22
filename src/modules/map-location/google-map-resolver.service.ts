import { Injectable } from '@nestjs/common';
import { isValidGoogleMapsUrl } from '../../common/validation/google-maps-url.validator';
import {
  extractDestinationCoordinates,
  extractPlaceId,
} from './google-maps-coordinate.util';
import type { ResolutionResult } from './map-location.types';
import {
  SafeGoogleRedirectService,
  UnsafeMapRedirectError,
} from './safe-google-redirect.service';

const SHORT_LINK_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

@Injectable()
export class GoogleMapResolverService {
  constructor(private readonly redirects: SafeGoogleRedirectService) {}

  async resolve(rawUrl: string): Promise<ResolutionResult> {
    if (!isValidGoogleMapsUrl(rawUrl)) {
      return { kind: 'unresolved', reasonCode: 'INVALID_URL' };
    }

    let url = new URL(rawUrl.trim());
    const directCoordinates = extractDestinationCoordinates(url);
    if (directCoordinates) {
      return { kind: 'resolved', coordinates: directCoordinates };
    }

    if (SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())) {
      try {
        url = await this.redirects.follow(url);
      } catch (error) {
        if (error instanceof UnsafeMapRedirectError) {
          return { kind: 'unresolved', reasonCode: error.reasonCode };
        }
        throw error;
      }
      const redirectedCoordinates = extractDestinationCoordinates(url);
      if (redirectedCoordinates) {
        return { kind: 'resolved', coordinates: redirectedCoordinates };
      }
    }

    if (extractPlaceId(url)) {
      // Google currently restricts caching Places content and its display on
      // non-Google maps. This project uses Leaflet and requires durable data,
      // so a paid Places lookup is deliberately not performed here.
      return { kind: 'unresolved', reasonCode: 'PLACE_ID_PROVIDER_DISABLED' };
    }

    return { kind: 'unresolved', reasonCode: 'DESTINATION_NOT_EXPLICIT' };
  }
}
