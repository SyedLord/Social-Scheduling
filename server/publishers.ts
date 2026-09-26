import { Post, SocialPlatform } from '../src/types.js';

type PublishableAccount = {
  id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  access_token_enc?: string;
  metadata?: Record<string, any>;
};

export interface ProviderPublishResult {
  id: string;
}

function requireToken(account: PublishableAccount): string {
  if (!account.access_token_enc) throw new Error('No provider access token is available. Reconnect this account.');
  return account.access_token_enc;
}

async function parseResponse(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.error_description || data.detail || data.message;
    throw new Error(message || `Provider request failed (HTTP ${response.status}).`);
  }
  return data;
}

function assertPublicHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname) throw new Error('Media URL must be a public HTTPS URL.');
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) throw new Error('Media URL must point to a public internet host.');
  return url;
}

function requireTextOnly(post: Post, platform: string) {
  if (post.media_urls?.length) {
    throw new Error(`${platform} publishing currently supports text-only posts. Remove media or select a platform with media support.`);
  }
}

async function publishX(post: Post, account: PublishableAccount): Promise<ProviderPublishResult> {
  requireTextOnly(post, 'X');
  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requireToken(account)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: post.content }),
  });
  const data = await parseResponse(response);
  if (!data.data?.id) throw new Error('X did not return the created post ID.');
  return { id: data.data.id };
}
async function publishLinkedIn(post: Post, account: PublishableAccount): Promise<ProviderPublishResult> {
  requireTextOnly(post, 'LinkedIn');
  const author = account.metadata?.author_urn || `urn:li:person:${account.platform_account_id}`;
  const version = process.env.LINKEDIN_API_VERSION || '202604';
  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireToken(account)}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': version,
    },
    body: JSON.stringify({
      author,
      commentary: post.content,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  const data = await parseResponse(response);
  const id = response.headers.get('x-restli-id') || data.id;
  if (!id) throw new Error('LinkedIn did not return the created post ID.');
  return { id };
}

async function publishFacebook(post: Post, account: PublishableAccount): Promise<ProviderPublishResult> {
  requireTextOnly(post, 'Facebook Pages');
  const version = process.env.META_GRAPH_API_VERSION || 'v26.0';
  const body = new URLSearchParams({ message: post.content, access_token: requireToken(account) });
  const response = await fetch(`https://graph.facebook.com/${version}/${account.platform_account_id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await parseResponse(response);
  if (!data.id) throw new Error('Meta did not return the created Page post ID.');
  return { id: data.id };
}
async function publishInstagram(post: Post, account: PublishableAccount): Promise<ProviderPublishResult> {
  if (post.media_urls?.length !== 1 || post.media_type !== 'image') {
    throw new Error('Instagram publishing currently supports one image per post. Use a public HTTPS image URL.');
  }
  const imageUrl = assertPublicHttpsUrl(post.media_urls[0]).toString();
  const version = process.env.META_GRAPH_API_VERSION || 'v26.0';
  const token = requireToken(account);
  const createBody = new URLSearchParams({ image_url: imageUrl, caption: post.content, access_token: token });
  const createResponse = await fetch(`https://graph.facebook.com/${version}/${account.platform_account_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createBody,
  });
  const container = await parseResponse(createResponse);
  if (!container.id) throw new Error('Instagram did not return a media container ID.');

  const publishBody = new URLSearchParams({ creation_id: container.id, access_token: token });
  const publishResponse = await fetch(`https://graph.facebook.com/${version}/${account.platform_account_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishBody,
  });
  const published = await parseResponse(publishResponse);
  if (!published.id) throw new Error('Instagram did not return the published media ID.');
  return { id: published.id };
}

async function publishYouTube(post: Post, account: PublishableAccount): Promise<ProviderPublishResult> {
  if (post.media_urls?.length !== 1 || post.media_type !== 'video') {
    throw new Error('YouTube publishing requires one video file attached to the post.');
  }
  const sourceUrl = assertPublicHttpsUrl(post.media_urls[0]);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error(`Could not fetch the video file (HTTP ${sourceResponse.status}).`);
  const declaredSize = Number(sourceResponse.headers.get('content-length') || 0);
  const maxBytes = 256 * 1024 * 1024;
  if (declaredSize > maxBytes) throw new Error('YouTube upload is limited to video files up to 256 MB.');
  const contentType = sourceResponse.headers.get('content-type') || 'application/octet-stream';
  if (!contentType.startsWith('video/')) throw new Error('The attached file URL did not return video content.');
  const video = Buffer.from(await sourceResponse.arrayBuffer());
  if (!video.length || video.length > maxBytes) throw new Error('Video must be between 1 byte and 256 MB.');
  const token = requireToken(account);
  const metadata = {
    snippet: { title: post.content.trim().slice(0, 100) || 'Scheduled video', description: post.content.slice(0, 5000), categoryId: '22' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };
  const initUrl = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
  initUrl.searchParams.set('uploadType', 'resumable');
  initUrl.searchParams.set('part', 'snippet,status');
  const initResponse = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(video.length),
      'X-Upload-Content-Type': contentType,
    },
    body: JSON.stringify(metadata),
  });
  if (!initResponse.ok) await parseResponse(initResponse);
  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube did not provide a resumable upload URL.');
  const finalResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(video.length) },
    body: video,
  });
  const result = await parseResponse(finalResponse);
  if (!result.id) throw new Error('YouTube did not return the uploaded video ID.');
  return { id: result.id };
}

export async function publishThroughProvider(
  post: Post,
  account: PublishableAccount
): Promise<ProviderPublishResult> {
  switch (account.platform) {
    case 'twitter': return publishX(post, account);
    case 'linkedin': return publishLinkedIn(post, account);
    case 'facebook': return publishFacebook(post, account);
    case 'instagram': return publishInstagram(post, account);
    case 'youtube': return publishYouTube(post, account);
    default: throw new Error('This social platform is not supported.');
  }
}