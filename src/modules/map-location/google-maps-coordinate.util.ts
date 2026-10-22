import type { ResolvedCoordinates } from './map-location.types';

const DECIMAL = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const EXACT_PAIR = new RegExp(`^\\s*(${DECIMAL})\\s*,\\s*(${DECIMAL})\\s*$`);
const DATA_PAIR =
  /!3d([+-]?(?:\d+(?:\.\d+)?|\.\d+))!4d([+-]?(?:\d+(?:\.\d+)?|\.\d+))/gi;

export function validCoordinates(
  latValue: string | number,
  lngValue: string | number,
): ResolvedCoordinates | null {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function exactPair(value: string): ResolvedCoordinates | null {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // URLSearchParams has already decoded normal query values. A malformed
    // percent escape simply cannot be an exact coordinate pair.
  }
  const match = decoded.match(EXACT_PAIR);
  return match ? validCoordinates(match[1], match[2]) : null;
}

function decodePathSegment(value: string): string | null {
  try {
    // Google short links use `+` as a space in redirect path segments even
    // though URL.pathname does not apply form-style plus decoding.
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/**
 * Extracts only coordinates that Google identifies as the destination itself.
 * Camera fragments such as /@lat,lng,zoom are intentionally ignored.
 */
export function extractDestinationCoordinates(
  url: URL,
): ResolvedCoordinates | null {
  const isDirectionsUrl =
    url.pathname === '/maps/dir' || url.pathname.startsWith('/maps/dir/');
  let serializedUrl = url.href;
  try {
    serializedUrl = decodeURIComponent(serializedUrl);
  } catch {
    // Continue with the parsed URL when it contains a malformed escape.
  }
  const dataMatch = Array.from(serializedUrl.matchAll(DATA_PAIR)).at(-1);
  if (dataMatch) {
    const coordinates = validCoordinates(dataMatch[1], dataMatch[2]);
    if (coordinates) return coordinates;
  }

  const rawPathParts = url.pathname.split('/').filter(Boolean);
  if (rawPathParts[0] === 'maps' && rawPathParts[1] === 'search') {
    const searchSegment = decodePathSegment(rawPathParts[2] ?? '');
    if (searchSegment !== null) {
      const coordinates = exactPair(searchSegment);
      if (coordinates) return coordinates;
    }
  }

  const coordinateParameters = isDirectionsUrl
    ? ['destination']
    : ['destination', 'query', 'q'];
  for (const parameter of coordinateParameters) {
    const values = url.searchParams.getAll(parameter);
    if (values.length !== 1) continue;
    const coordinates = exactPair(values[0]);
    if (coordinates) return coordinates;
  }

  if (isDirectionsUrl) {
    const parts = url.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      });
    const destinationParts = parts
      .slice(2)
      .filter((part) => !part.startsWith('@'));
    for (let index = destinationParts.length - 1; index >= 0; index -= 1) {
      const coordinates = exactPair(destinationParts[index]);
      if (coordinates) return coordinates;
    }
  }

  return null;
}

export function extractPlaceId(url: URL): string | null {
  const candidates = [
    url.searchParams.get('query_place_id'),
    url.searchParams.get('place_id'),
  ];
  const q = url.searchParams.get('q') ?? url.searchParams.get('query');
  if (q?.startsWith('place_id:')) candidates.push(q.slice('place_id:'.length));

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /^[A-Za-z0-9_-]{10,255}$/.test(value)) return value;
  }
  return null;
}
