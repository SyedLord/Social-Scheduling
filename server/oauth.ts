import crypto from 'crypto';
import { SocialPlatform } from '../src/types.js';
import { db } from './db.js';

interface PKCESession {
  state: string;
  codeVerifier: string;
  platform: SocialPlatform;
  workspaceId: string;
  createdAt: number;
}

// In-memory PKCE state session store with 10 min TTL
const pkceSessions = new Map<string, PKCESession>();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of pkceSessions.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      pkceSessions.delete(key);
    }
  }
}

// Helper: base64url encoding
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper: SHA256
function sha256(buffer: string): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

export class OAuthService {
  private getAppUrl(reqProtocol?: string, reqHost?: string): string {
    const envAppUrl = process.env.APP_URL;
    if (envAppUrl && !envAppUrl.includes('MY_APP_URL') && !envAppUrl.includes('localhost')) {
      return envAppUrl.replace(/\/$/, '');
    }
    if (reqProtocol && reqHost) {
      return `${reqProtocol}://${reqHost}`;
    }
    return 'http://localhost:3000';
  }

  private isPlatformConfigured(platform: SocialPlatform): boolean {
    const hasTokenKey = Boolean(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);
    if (!hasTokenKey) return false;
    switch (platform) {
      case 'twitter': return Boolean(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET);
      case 'instagram':
      case 'facebook': return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
      case 'linkedin': return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
      case 'youtube': return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      default: return false;
    }
  }

  // Generate authorization URL and store PKCE / state
  public generateAuthUrl(
    platform: SocialPlatform,
    workspaceId: string,
    reqProtocol?: string,
    reqHost?: string
  ): { url: string; state: string; isLiveConfigured: boolean; platform: SocialPlatform } {
    if (!this.isPlatformConfigured(platform)) {
      return { url: '', state: '', isLiveConfigured: false, platform };
    }
    cleanupExpiredSessions();
    const state = `st_${platform}_${crypto.randomBytes(16).toString('hex')}`;
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));

    pkceSessions.set(state, {
      state,
      codeVerifier,
      platform,
      workspaceId,
      createdAt: Date.now(),
    });

    const appUrl = this.getAppUrl(reqProtocol, reqHost);
    const redirectUri = `${appUrl}/api/oauth/${platform}/callback`;

    let url = '';
    let isLiveConfigured = false;

    switch (platform) {
      case 'twitter': {
        const clientId = process.env.TWITTER_CLIENT_ID;
        if (clientId) {
          isLiveConfigured = true;
          const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'tweet.read tweet.write users.read offline.access',
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          });
          url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
        } else {
          url = '';
        }
        break;
      }

      case 'instagram': {
        const appId = process.env.META_APP_ID;
        if (appId) {
          isLiveConfigured = true;
          const params = new URLSearchParams({
            client_id: appId,
            redirect_uri: redirectUri,
            scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
            response_type: 'code',
            state,
          });
          url = `https://www.facebook.com/v26.0/dialog/oauth?${params.toString()}`;
        } else {
          url = '';
        }
        break;
      }

      case 'facebook': {
        const appId = process.env.META_APP_ID;
        if (appId) {
          isLiveConfigured = true;
          const params = new URLSearchParams({
            client_id: appId,
            redirect_uri: redirectUri,
            scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content',
            response_type: 'code',
            state,
          });
          url = `https://www.facebook.com/v26.0/dialog/oauth?${params.toString()}`;
        } else {
          url = '';
        }
        break;
      }

      case 'linkedin': {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        if (clientId) {
          isLiveConfigured = true;
          const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'w_member_social openid profile email',
            state,
          });
          url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
        } else {
          url = '';
        }
        break;
      }

      case 'youtube': {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (clientId) {
          isLiveConfigured = true;
          const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
            access_type: 'offline',
            prompt: 'consent',
            state,
          });
          url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        } else {
          url = '';
        }
        break;
      }
    }

    return { url, state, isLiveConfigured, platform };
  }

  // Handle incoming OAuth callback and token exchange
  public async handleCallback(
    platform: SocialPlatform,
    code: string,
    state: string,
    reqProtocol?: string,
    reqHost?: string
  ): Promise<{ success: boolean; accountId?: string; error?: string }> {
    const session = pkceSessions.get(state);
    if (!session || session.platform !== platform) {
      return { success: false, error: 'Invalid or expired OAuth state parameter (CSRF protection)' };
    }

    pkceSessions.delete(state);
    const appUrl = this.getAppUrl(reqProtocol, reqHost);
    const redirectUri = `${appUrl}/api/oauth/${platform}/callback`;

    try {
      // If live credentials present, execute live exchange
      if (platform === 'twitter' && process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
        return await this.exchangeTwitterLiveToken(session.workspaceId, code, session.codeVerifier, redirectUri);
      } else if ((platform === 'instagram' || platform === 'facebook') && process.env.META_APP_ID && process.env.META_APP_SECRET) {
        return await this.exchangeMetaLiveToken(platform, session.workspaceId, code, redirectUri);
      } else if (platform === 'linkedin' && process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
        return await this.exchangeLinkedInLiveToken(session.workspaceId, code, redirectUri);
      } else if (platform === 'youtube' && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        return await this.exchangeGoogleLiveToken(session.workspaceId, code, redirectUri);
      } else {
        return { success: false, error: `Live OAuth credentials are not configured for ${platform}.` };
      }
    } catch (err: any) {
      console.error(`Error exchanging token for ${platform}:`, err);
      return { success: false, error: err.message || `Token exchange failed for ${platform}` };
    }
  }

  // Twitter OAuth 2.0 PKCE Live Exchange
  private async exchangeTwitterLiveToken(
    workspaceId: string,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ) {
    const basicAuth = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Twitter token exchange failed');
    }

    // Fetch Twitter user info
    const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    if (!userRes.ok || !userData.data?.id || !userData.data?.username) throw new Error(userData.detail || 'Could not read the authenticated X account profile.');
    const twitterUser = userData.data;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString();

    const result = db.addAccount({
      workspace_id: workspaceId,
      platform: 'twitter',
      platform_account_id: twitterUser.id,
      account_name: twitterUser.name,
      account_handle: `@${twitterUser.username}`,
      account_avatar: twitterUser.profile_image_url,
      token_expires_at: expiresAt,
      access_token_enc: tokenData.access_token,
      refresh_token_enc: tokenData.refresh_token,
      metadata: {
        follower_count: twitterUser.public_metrics?.followers_count ?? 0,
      },
    });

    if (result.error) return { success: false, error: result.error };
    return { success: true, accountId: result.account?.id };
  }

  // Meta Live Exchange (Instagram Graph / Facebook Pages)
  private async exchangeMetaLiveToken(
    platform: 'instagram' | 'facebook',
    workspaceId: string,
    code: string,
    redirectUri: string
  ) {
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;

    // 1. Get short-lived user token
    const tokenUrl = `https://graph.facebook.com/v26.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_secret=${appSecret}&code=${code}`;

    const res = await fetch(tokenUrl);
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || 'Meta token exchange failed');
    }

    // 2. Exchange for 60-day long-lived token
    const longLivedUrl = `https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${data.access_token}`;
    const llRes = await fetch(longLivedUrl);
    const llData = await llRes.json();
    if (!llRes.ok || !llData.access_token) throw new Error(llData.error?.message || 'Meta long-lived token exchange failed.');
    const longLivedToken = llData.access_token;
    const expiresAt = new Date(Date.now() + (llData.expires_in || 5184000) * 1000).toISOString();

    if (platform === 'facebook') {
      // Get pages
      const pagesRes = await fetch(`https://graph.facebook.com/v26.0/me/accounts?fields=id,name,picture,access_token,category&access_token=${longLivedToken}`);
      const pagesData = await pagesRes.json();
      if (!pagesRes.ok || !Array.isArray(pagesData.data) || pagesData.data.length === 0) throw new Error(pagesData.error?.message || 'No Facebook Pages were returned for this account.');
      const page = pagesData.data[0];

      const result = db.addAccount({
        workspace_id: workspaceId,
        platform: 'facebook',
        platform_account_id: page.id,
        account_name: page.name,
        account_handle: `fb.com/${page.id}`,
        account_avatar: page.picture?.data?.url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150&auto=format&fit=crop&q=80',
        token_expires_at: expiresAt,
        access_token_enc: page.access_token || longLivedToken,
        metadata: { page_id: page.id, category: page.category },
      });
      if (result.error) return { success: false, error: result.error };
      return { success: true, accountId: result.account?.id };
    } else {
      // Instagram: Fetch connected IG business account
      const igRes = await fetch(`https://graph.facebook.com/v26.0/me/accounts?fields=instagram_business_account{id,username,profile_picture_url,followers_count}&access_token=${longLivedToken}`);
      const igData = await igRes.json();
      if (!igRes.ok) throw new Error(igData.error?.message || 'Could not list Facebook Pages for Instagram connection.');
      const igAcc = igData.data?.find((entry: any) => entry.instagram_business_account)?.instagram_business_account;
      if (!igAcc?.id || !igAcc?.username) throw new Error('No eligible Instagram professional account linked to a Facebook Page was found.');

      const result = db.addAccount({
        workspace_id: workspaceId,
        platform: 'instagram',
        platform_account_id: igAcc.id,
        account_name: igAcc.username || 'Instagram Creator',
        account_handle: `@${igAcc.username || 'creator'}`,
        account_avatar: igAcc.profile_picture_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80',
        token_expires_at: expiresAt,
        access_token_enc: longLivedToken,
        metadata: { follower_count: igAcc.followers_count ?? 0 },
      });
      if (result.error) return { success: false, error: result.error };
      return { success: true, accountId: result.account?.id };
    }
  }

  // LinkedIn Live Exchange
  private async exchangeLinkedInLiveToken(workspaceId: string, code: string, redirectUri: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description || 'LinkedIn token exchange failed');
    }

    // Get user profile
    const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userRes.json();
    if (!userRes.ok || !userData.sub || !userData.name) throw new Error(userData.message || 'Could not read the authenticated LinkedIn profile.');

    const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();
    const result = db.addAccount({
      workspace_id: workspaceId,
      platform: 'linkedin',
      platform_account_id: userData.sub,
      account_name: userData.name,
      account_handle: userData.sub,
      account_avatar: userData.picture,
      token_expires_at: expiresAt,
      access_token_enc: data.access_token,
      refresh_token_enc: data.refresh_token,
      metadata: {},
    });

    if (result.error) return { success: false, error: result.error };
    return { success: true, accountId: result.account?.id };
  }

  // Google / YouTube Data API v3 Live Exchange
  private async exchangeGoogleLiveToken(workspaceId: string, code: string, redirectUri: string) {
    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description || 'YouTube token exchange failed');
    }

    // Fetch YouTube channel info
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    );
    const chData = await chRes.json();
    const channel = chData.items?.[0];
    if (!chRes.ok || !channel?.id || !channel?.snippet?.title) throw new Error(chData.error?.message || 'No YouTube channel was returned for this Google account.');

    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    const result = db.addAccount({
      workspace_id: workspaceId,
      platform: 'youtube',
      platform_account_id: channel.id,
      account_name: channel.snippet.title,
      account_handle: `@${channel.snippet.title.replace(/\s+/g, '')}`,
      account_avatar: channel.snippet.thumbnails?.default?.url,
      token_expires_at: expiresAt,
      access_token_enc: data.access_token,
      refresh_token_enc: data.refresh_token,
      metadata: {
        subscriber_count: Number.parseInt(channel.statistics?.subscriberCount || '0', 10),
      },
    });

    if (result.error) return { success: false, error: result.error };
    return { success: true, accountId: result.account?.id };
  }

  public async refreshAccountToken(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = db.getRawAccount(accountId);
    if (!account) return { success: false, error: 'Account not found' };
    const refreshToken = account.refresh_token_enc;
    if (!refreshToken) return { success: false, error: 'This provider did not issue a refresh token. Reconnect the account.' };

    try {
      let endpoint = '';
      let params = new URLSearchParams();
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (account.platform === 'twitter') {
        endpoint = 'https://api.x.com/2/oauth2/token';
        params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
        headers.Authorization = `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')}`;
      } else if (account.platform === 'linkedin') {
        endpoint = 'https://www.linkedin.com/oauth/v2/accessToken';
        params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.LINKEDIN_CLIENT_ID || '',
          client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        });
      } else if (account.platform === 'youtube') {
        endpoint = 'https://oauth2.googleapis.com/token';
        params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        });
      } else {
        return { success: false, error: `Automatic refresh is not available for ${account.platform}. Reconnect through provider OAuth.` };
      }

      const response = await fetch(endpoint, { method: 'POST', headers, body: params.toString() });
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        db.updateAccountTokens(accountId, { status: 'expired' });
        return { success: false, error: data.error_description || data.error?.message || 'Provider token refresh failed. Reconnect this account.' };
      }
      db.updateAccountTokens(accountId, {
        access_token_enc: data.access_token,
        refresh_token_enc: data.refresh_token || refreshToken,
        token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
        status: 'active',
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed.' };
    }
  }
}

export const oauthService = new OAuthService();