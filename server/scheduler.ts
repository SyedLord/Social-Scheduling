import { publishThroughProvider } from './publishers.js';
import { oauthService } from './oauth.js';
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

  private async publishToPlatform(post: Post, account: any): Promise<PublishResult> {
    const platform = account.platform as SocialPlatform;
    const config = PLATFORM_CONFIGS[platform];
    if (!config) return {
      platform, accountId: account.id, success: false, errorCode: 'UNSUPPORTED_PLATFORM',
      errorMessage: 'This social platform is not supported.', executionTimeMs: 0,
    };

    if (account.status === 'revoked') return {
      platform, accountId: account.id, success: false, errorCode: 'ACCOUNT_REVOKED',
      errorMessage: config.name + ' account is disconnected. Reconnect it before publishing.',
      actionableRemedy: 'Reconnect this account from Workspace Channels.', executionTimeMs: 0,
    };

    if (account.token_expires_at && new Date(account.token_expires_at).getTime() <= Date.now() + 5 * 60 * 1000) {
      const refreshed = await oauthService.refreshAccountToken(account.id);
      if (!refreshed.success) return {
        platform, accountId: account.id, success: false, errorCode: 'TOKEN_REFRESH_FAILED',
        errorMessage: refreshed.error || (config.name + ' authorization expired.'),
        actionableRemedy: 'Reconnect this account from Workspace Channels.', executionTimeMs: 0,
      };
      account = db.getRawAccount(account.id) || account;
    }

    if (!account.access_token_enc) return {
      platform, accountId: account.id, success: false, errorCode: 'MISSING_PROVIDER_TOKEN',
      errorMessage: config.name + ' has no usable OAuth access token.',
      actionableRemedy: 'Reconnect this account from Workspace Channels.', executionTimeMs: 0,
    };

    if (post.content.length > config.maxCharacters) return {
      platform, accountId: account.id, success: false, errorCode: 'PAYLOAD_TOO_LARGE',
      errorMessage: 'Post is longer than ' + config.name + ' allows (' + config.maxCharacters + ' characters).',
      actionableRemedy: 'Shorten the post for this platform.', executionTimeMs: 0,
    };

    try {
      const published = await publishThroughProvider(post, account);
      return { platform, accountId: account.id, success: true, platformPostId: published.id, executionTimeMs: 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The social platform rejected this post.';
      return {
        platform, accountId: account.id, success: false, errorCode: 'PROVIDER_PUBLISH_FAILED',
        errorMessage: message, actionableRemedy: 'Check platform permissions and post requirements, then retry.',
        executionTimeMs: 0,
      };
    }
  }
}

export const schedulingEngine = new SchedulingEngine();