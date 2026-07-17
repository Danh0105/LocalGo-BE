import {
  GOOGLE_MAPS_URL_MAX_LENGTH,
  isValidGoogleMapsUrl,
} from './google-maps-url.util';

describe('isValidGoogleMapsUrl', () => {
  it('treats empty/whitespace-only input as valid (not provided yet)', () => {
    expect(isValidGoogleMapsUrl('')).toBe(true);
    expect(isValidGoogleMapsUrl('   ')).toBe(true);
  });

  it('accepts full google.com/maps and www.google.com/maps links', () => {
    expect(
      isValidGoogleMapsUrl(
        'https://www.google.com/maps/place/Ch%E1%BB%A3+Th%E1%BB%A7+D%E1%BA%A7u+M%E1%BB%99t',
      ),
    ).toBe(true);
    expect(isValidGoogleMapsUrl('https://google.com/maps/dir/?api=1')).toBe(
      true,
    );
    expect(isValidGoogleMapsUrl('https://www.google.com/maps')).toBe(true);
  });

  it('accepts maps.google.com and maps.app.goo.gl on any path', () => {
    expect(isValidGoogleMapsUrl('https://maps.google.com/?q=abc')).toBe(true);
    expect(isValidGoogleMapsUrl('https://maps.app.goo.gl/example')).toBe(true);
  });

  it('accepts goo.gl only under /maps/', () => {
    expect(isValidGoogleMapsUrl('https://goo.gl/maps/example')).toBe(true);
  });

  it('rejects goo.gl and google.com paths outside /maps', () => {
    expect(isValidGoogleMapsUrl('https://goo.gl/other-path')).toBe(false);
    expect(isValidGoogleMapsUrl('https://www.google.com/search?q=abc')).toBe(
      false,
    );
  });

  it('rejects non-HTTPS schemes', () => {
    expect(isValidGoogleMapsUrl('http://www.google.com/maps')).toBe(false);
    expect(isValidGoogleMapsUrl('javascript:alert(1)')).toBe(false);
    expect(
      isValidGoogleMapsUrl('data:text/html,<script>alert(1)</script>'),
    ).toBe(false);
  });

  it('rejects lookalike/decoy domains via exact hostname match', () => {
    expect(
      isValidGoogleMapsUrl('https://www.google.com.evil.example/maps'),
    ).toBe(false);
    expect(isValidGoogleMapsUrl('https://evil.example/?www.google.com')).toBe(
      false,
    );
  });

  it('rejects URLs carrying credentials', () => {
    expect(isValidGoogleMapsUrl('https://user:pass@www.google.com/maps')).toBe(
      false,
    );
  });

  it('rejects unparseable URLs', () => {
    expect(isValidGoogleMapsUrl('not a url')).toBe(false);
  });

  it('rejects URLs longer than the max length', () => {
    const longPath = 'a'.repeat(GOOGLE_MAPS_URL_MAX_LENGTH);
    expect(isValidGoogleMapsUrl(`https://maps.google.com/?q=${longPath}`)).toBe(
      false,
    );
  });
});
