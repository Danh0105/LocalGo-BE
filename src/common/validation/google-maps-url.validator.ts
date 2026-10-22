import { registerDecorator, type ValidationOptions } from 'class-validator';

export const GOOGLE_MAPS_URL_MAX_LENGTH = 2048;

const ALLOWED_HOSTS_ANY_PATH = new Set(['maps.google.com', 'maps.app.goo.gl']);

/**
 * An empty value means the location link has not been configured yet. This
 * keeps existing content editable while still rejecting unsafe/non-Maps URLs.
 */
export function isValidGoogleMapsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > GOOGLE_MAPS_URL_MAX_LENGTH) return false;
  if (
    Array.from(trimmed).some((character) => {
      const code = character.charCodeAt(0);
      return character === '\\' || code <= 31 || code === 127;
    })
  )
    return false;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;
  if (url.port !== '' && url.port !== '443') return false;

  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS_ANY_PATH.has(host)) return true;
  if (host === 'www.google.com' || host === 'google.com') {
    return url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  }
  if (host === 'goo.gl') {
    return url.pathname.startsWith('/maps/');
  }
  return false;
}

export function IsGoogleMapsUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isGoogleMapsUrl',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidGoogleMapsUrl(value);
        },
        defaultMessage(): string {
          return 'googleMapsUrl phải là link Google Maps hợp lệ (https://www.google.com/maps/..., https://maps.google.com/..., https://maps.app.goo.gl/... hoặc https://goo.gl/maps/...)';
        },
      },
    });
  };
}
