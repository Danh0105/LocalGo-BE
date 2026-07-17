export interface ZaloProfile {
  zaloId: string;
  name: string;
  avatarUrl?: string;
}

export interface ZaloAuthProvider {
  verifyAccessToken(accessToken: string): Promise<ZaloProfile>;
}
