export type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'youtube';

export type AccountStatus = 'active' | 'expiring_soon' | 'expired' | 'revoked';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export type WorkspacePlan = 'free' | 'pro' | 'enterprise';

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  password?: string;
  active_license_id?: string;
  created_at: string;
}

export interface LicenseKey {
  id: string;
  key: string;
  label: string;
  max_workspaces: number;
  validity_days: number;
  created_at: string;
  activated_at?: string;
  expires_at?: string;
  is_redeemed: boolean;
  redeemed_by_user_id?: string;
  redeemed_by_user_email?: string;
  is_revoked: boolean;
  revoked_at?: string;
  status: 'available' | 'active' | 'expired' | 'revoked';
}

export interface WorkspaceSettings {
  timezone: string;
  max_accounts: number;
  max_scheduled_posts: number;
  auto_retry_failed: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  owner_id: string;
  is_locked?: boolean;
  settings: WorkspaceSettings;
  created_at: string;
  updated_at: string;
  stats?: {
    connected_accounts: number;
    scheduled_posts_count: number;
    published_posts_count: number;
    failed_posts_count: number;
  };
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  user?: User;
  joined_at: string;
}

export interface AccountMetadata {
  page_id?: string;
  page_name?: string;
  follower_count?: number;
  subscriber_count?: number;
  category?: string;
  verified?: boolean;
}

export interface WorkspaceAccount {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  account_name: string;
  account_handle: string;
  account_avatar?: string;
  is_active: boolean;
  status: AccountStatus;
  token_expires_at?: string;
  metadata: AccountMetadata;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  author_id?: string;
  author_name?: string;
  content: string;
  media_urls: string[];
  media_type: 'none' | 'image' | 'video' | 'carousel';
  target_platforms: SocialPlatform[];
  target_account_ids: string[];
  status: PostStatus;
  scheduled_at?: string;
  published_at?: string;
  error_message?: string;
  error_details?: {
    platform?: SocialPlatform;
    code?: string;
    actionable_remedy?: string;
    raw_error?: string;
  };
  platform_post_ids?: Record<string, string>;
  created_at: string;
  updated_at: string;
  analytics?: PostAnalytics;
}

export interface PostAnalytics {
  id: string;
  post_id: string;
  workspace_account_id?: string;
  platform?: SocialPlatform;
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  retweets_shares: number;
  comments: number;
  clicks: number;
  updated_at: string;
}

export interface DispatchLog {
  id: string;
  workspace_id: string;
  post_id?: string;
  post_title?: string;
  workspace_account_id?: string;
  account_handle?: string;
  platform: SocialPlatform;
  status: 'success' | 'failure' | 'rate_limited';
  error_code?: string;
  error_message?: string;
  payload_preview?: {
    content_length: number;
    has_media: boolean;
    media_type?: string;
  };
  execution_time_ms: number;
  created_at: string;
}

export interface PlatformLimitInfo {
  maxCharacters: number;
  supportedMedia: Array<'image' | 'video' | 'carousel'>;
  characterWarningThreshold: number;
  name: string;
  color: string;
}

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformLimitInfo> = {
  twitter: {
    name: 'X (Twitter)',
    maxCharacters: 280,
    supportedMedia: ['image', 'video'],
    characterWarningThreshold: 260,
    color: '#1DA1F2',
  },
  linkedin: {
    name: 'LinkedIn',
    maxCharacters: 3000,
    supportedMedia: ['image', 'video'],
    characterWarningThreshold: 2800,
    color: '#0A66C2',
  },
  instagram: {
    name: 'Instagram',
    maxCharacters: 2200,
    supportedMedia: ['image', 'video', 'carousel'],
    characterWarningThreshold: 2000,
    color: '#E4405F',
  },
  facebook: {
    name: 'Facebook Pages',
    maxCharacters: 63206,
    supportedMedia: ['image', 'video', 'carousel'],
    characterWarningThreshold: 50000,
    color: '#1877F2',
  },
  youtube: {
    name: 'YouTube',
    maxCharacters: 5000,
    supportedMedia: ['video'],
    characterWarningThreshold: 4500,
    color: '#FF0000',
  },
};
