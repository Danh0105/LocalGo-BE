import { AppException } from '../../../common/exceptions/app.exception';
import { RealZaloAuthProvider } from './real-zalo-auth.provider';

function fakeConfigService(zaloAppSecret: string | undefined) {
  return {
    getOrThrow: () => ({ zaloAuthMode: 'real', zaloAppSecret }),
  } as never;
}

function mockFetchOnce(response: {
  ok: boolean;
  json: () => Promise<unknown>;
}) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(response as Response);
}

describe('RealZaloAuthProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects an empty access token without calling Zalo', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('secret'));
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(provider.verifyAccessToken('   ')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps a successful Zalo Graph API response into ZaloProfile', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('secret'));
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'zalo-123',
          name: 'Nguyễn Văn A',
          picture: { data: { url: 'https://example.invalid/avatar.jpg' } },
        }),
    });

    const profile = await provider.verifyAccessToken('valid-token');
    expect(profile).toEqual({
      zaloId: 'zalo-123',
      name: 'Nguyễn Văn A',
      avatarUrl: 'https://example.invalid/avatar.jpg',
    });
  });

  it('sends the access token and secret_key header to the Zalo Graph API', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('my-secret'));
    const fetchSpy = mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'zalo-1', name: 'A' }),
    });

    await provider.verifyAccessToken('abc-token');

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(calledUrl.toString()).toBe(
      'https://graph.zalo.me/v2.0/me?access_token=abc-token&fields=id%2Cname%2Cpicture',
    );
    expect(calledInit.headers).toMatchObject({ secret_key: 'my-secret' });
  });

  it('rejects when Zalo returns an error payload', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('secret'));
    mockFetchOnce({
      ok: false,
      json: () =>
        Promise.resolve({ error: -216, message: 'Access token invalid' }),
    });

    await expect(
      provider.verifyAccessToken('expired-token'),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Access token invalid',
    });
  });

  it('rejects with a distinct code when Zalo is unreachable', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('secret'));
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));

    await expect(provider.verifyAccessToken('any-token')).rejects.toMatchObject(
      {
        code: 'INTERNAL_ERROR',
      },
    );
  });

  it('rejects when the Zalo response is missing required fields', async () => {
    const provider = new RealZaloAuthProvider(fakeConfigService('secret'));
    mockFetchOnce({ ok: true, json: () => Promise.resolve({ id: '' }) });

    await expect(
      provider.verifyAccessToken('any-token'),
    ).rejects.toBeInstanceOf(AppException);
  });
});
