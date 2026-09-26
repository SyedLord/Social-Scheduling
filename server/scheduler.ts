import crypto from 'crypto';
import { db } from './db.js';
import { Post, SocialPlatform, PLATFORM_CONFIGS } from '../src/types.js';

interface PublishResult {
  platform: SocialPlatform;
  accountId: string;
  success: boolean;
  platformPostId?: string;
  errorCode?: string;
  errorMessage?: string;
  actionableRemedy?: string;
  executionTimeMs: number;
}

export class SchedulingEngine {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 10000; // poll every 10 seconds

  public start() {
    if (this.intervalId) return;
    console.log('[Scheduler] Dispatch Engine started. Polling every 10s...');
    this.intervalId = setInterval(() => {
      this.pollAndDispatch().catch((err) => {
        console.error('[Scheduler] Error during dispatch poll:', err);
      });
    }, this.pollIntervalMs);

    // Initial immediate poll after 2 seconds
    setTimeout(() => this.pollAndDispatch(), 2000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Dispatch Engine stopped.');
    }
  }

  public async pollAndDispatch(): Promise<{ processedCount: number; results: any[] }> {
    if (this.isRunning) {
      return { processedCount: 0, results: [] };
    }
    this.isRunning = true;
    const results: any[] = [];

    try {
      const duePosts = db.getDueScheduledPosts();
      if (duePosts.length > 0) {
        console.log(`[Scheduler] Found ${duePosts.length} due posts for dispatch.`);
      }

      for (const post of duePosts) {
        const dispatchResult = await this.dispatchPost(post);
        results.push(dispatchResult);
      }
      return { processedCount: duePosts.length, results };
    } finally {
      this.isRunning = false;
    }
  }

  public async dispatchPost(post: Post): Promise<{ post: Post; results: PublishResult[] }> {
    console.log(`[Scheduler] Dispatching post ${post.id}: "${post.content.slice(0, 40)}..."`);
    // Mark as publishing
    db.updatePost(post.workspace_id, post.id, { status: 'publishing' });

    const publishResults: PublishResult[] = [];
    const platformPostIds: Record<string, string> = {};

    // Get target accounts
    const allWsAccounts = db.getAccounts(post.workspace_id);
    const targetAccounts = allWsAccounts.filter((a) =>
      post.target_account_ids.includes(a.id) || post.target_platforms.includes(a.platform)
    );

    // If no specific accounts linked, find default active for target platforms
    const finalAccounts = targetAccounts.length > 0
      ? targetAccounts
      : allWsAccounts.filter((a) => post.target_platforms.includes(a.platform));

    if (finalAccounts.length === 0) {
      const errorMsg = 'No connected social accounts found for selected platforms. Please connect channels first.';
      db.updatePost(post.workspace_id, post.id, {
        status: 'failed',
        error_message: errorMsg,
        error_details: {
          code: 'NO_ACCOUNTS_CONNECTED',
          actionable_remedy: 'Connect at least one active channel in Workspace Channels view.',
        },
      });
      db.logDispatch({
        workspace_id: post.workspace_id,
        post_id: post.id,
        post_title: post.content.slice(0, 40) + '...',
        platform: post.target_platforms[0] || 'twitter',
        status: 'failure',
        error_code: 'NO_CHANNELS',
        error_message: errorMsg,
        execution_time_ms: 12,
      });
      return { post, results: [] };
    }

    let allSucceeded = true;
    let lastError: { code: string; message: string; remedy: string; platform: SocialPlatform } | null = null;

    for (const account of finalAccounts) {
      const startTime = Date.now();
      const rawAccount = db.getRawAccount(account.id);
      const res = await this.publishToPlatform(post, rawAccount || account);
      const duration = Date.now() - startTime;
      res.executionTimeMs = duration;

      publishResults.push(res);

      if (res.success && res.platformPostId) {
        platformPostIds[res.platform] = res.platformPostId;
        db.logDispatch({
          workspace_id: post.workspace_id,
          post_id: post.id,
          post_title: post.content.slice(0, 40) + '...',
          workspace_account_id: account.id,
          account_handle: account.account_handle,
          platform: res.platform,
          status: 'success',
          payload_preview: {
            content_length: post.content.length,
            has_media: post.media_urls.length > 0,
            media_type: post.media_type,
          },
          execution_time_ms: duration,
        });
      } else {
        allSucceeded = false;
        lastError = {
          code: res.errorCode || 'UNKNOWN_PUBLISH_ERROR',
          message: res.errorMessage || 'Failed to dispatch to social network',
          remedy: res.actionableRemedy || 'Verify account connection and media specs.',
          platform: res.platform,
        };
        db.logDispatch({
          workspace_id: post.workspace_id,
          post_id: post.id,
          post_title: post.content.slice(0, 40) + '...',
          workspace_account_id: account.id,
          account_handle: account.account_handle,
          platform: res.platform,
          status: 'failure',
          error_code: res.errorCode,
          error_message: res.errorMessage,
          payload_preview: {
            content_length: post.content.length,
            has_media: post.media_urls.length > 0,
            media_type: post.media_type,
          },
          execution_time_ms: duration,
        });
      }
    }

    if (allSucceeded) {
      const updated = db.updatePost(post.workspace_id, post.id, {
        status: 'published',
        published_at: new Date().toISOString(),
        platform_post_ids: platformPostIds,
        error_message: undefined,
        error_details: undefined,
      });

      db.save();

      return { post: updated.post || post, results: publishResults };
    } else {
      const updated = db.updatePost(post.workspace_id, post.id, {
        status: 'failed',
        error_message: lastError?.message,
        error_details: lastError ? {
          platform: lastError.platform,
          code: lastError.code,
          actionable_remedy: lastError.remedy,
          raw_error: lastError.message,
        } : undefined,
      });
      return { post: updated.post || post, results: publishResults };
    }
  }

  // Platform-specific publisher with constraints, media checks, rate limiting & error handling
  private async publishToPlatform(post: Post, account: any): Promise<PublishResult> {
    const platform = account.platform as SocialPlatform;
    const config = PLATFORM_CONFIGS[platform];

    // 1. Check account token validity
    if (account.status === 'expired' || account.status === 'revoked') {
      return {
        platform,
        accountId: account.id,
        success: false,
        errorCode: 'TOKEN_EXPIRED',
        errorMessage: `${config.name} OAuth access token is expired or revoked.`,
        actionableRemedy: `Go to Workspace Channels and click "Re-authenticate" on ${config.name} to refresh your credentials.`,
        executionTimeMs: 0,
      };
    }

    if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
      return {
        platform,
        accountId: account.id,
        success: false,
        errorCode: 'TOKEN_EXPIRED',
        errorMessage: `${config.name} token expired at ${account.token_expires_at}.`,
        actionableRemedy: `Click "Re-authenticate" on ${config.name} in Channels view to acquire a fresh OAuth 2.0 grant.`,
        executionTimeMs: 0,
      };
    }

    // 2. Platform payload constraint validation
    if (post.content.length > config.maxCharacters) {
      return {
        platform,
        accountId: account.id,
        success: false,
        errorCode: 'PAYLOAD_TOO_LARGE',
        errorMessage: `Post content length (${post.content.length} characters) exceeds ${config.name}'s strict limit of ${config.maxCharacters} characters.`,
        actionableRemedy: `Trim ${post.content.length - config.maxCharacters} characters or customize platform-specific copy in the composer.`,
        executionTimeMs: 0,
      };
    }

    // 3. Media requirements validation
    if (platform === 'instagram' && (!post.media_urls || post.media_urls.length === 0)) {
      return {
        platform,
        accountId: account.id,
        success: false,
        errorCode: 'INSTAGRAM_REQUIRES_MEDIA',
        errorMessage: 'Instagram Graph API content publishing requires at least 1 image or video asset. Pure text updates are not supported by Instagram.',
        actionableRemedy: 'Attach an image or video to your post before dispatching to Instagram.',
        executionTimeMs: 0,
      };
    }

    if (platform === 'youtube') {
      const hasVideo = post.media_type === 'video' || post.media_urls.some((u) => u.includes('.mp4') || u.includes('video'));
      if (!hasVideo && (!post.media_urls || post.media_urls.length === 0)) {
        return {
          platform,
          accountId: account.id,
          success: false,
          errorCode: 'YOUTUBE_REQUIRES_VIDEO',
          errorMessage: 'YouTube Data API v3 uploads require a video asset.',
          actionableRemedy: 'Attach a valid video asset or target YouTube Community post with media.',
          executionTimeMs: 0,
        };
      }
    }

    // Never report a post as published until a real platform API confirms it.
    return {
      platform,
      accountId: account.id,
      success: false,
      errorCode: 'PUBLISHER_NOT_CONFIGURED',
      errorMessage: `Publishing to ${config.name} is unavailable because a verified platform publishing adapter is not configured.`,
      actionableRemedy: 'Connect an approved platform app and configure its publishing integration before scheduling live posts.',
      executionTimeMs: 0,
    };
  }
}

export const schedulingEngine = new SchedulingEngine();