import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured, readTable, replaceRows } from './supabase.js';
import {
  User,
  UserRole,
  LicenseKey,
  Workspace,
  WorkspaceMember,
  WorkspaceAccount,
  Post,
  PostAnalytics,
  DispatchLog,
  SocialPlatform,
  PostStatus,
  WorkspacePlan,
} from '../src/types.js';

interface DatabaseSchema {
  users: User[];
  workspaces: Workspace[];
  license_keys: LicenseKey[];
  workspace_members: WorkspaceMember[];
  workspace_accounts: (WorkspaceAccount & { access_token_enc?: string; refresh_token_enc?: string })[];
  posts: Post[];
  post_analytics: PostAnalytics[];
  dispatch_logs: DispatchLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'omnipost_store.json');

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) return stored === password; // legacy in-memory seed only
  const [, salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

// Initial seed data generator
function getInitialSeed(): DatabaseSchema {
  const adminUser: User = {
    id: 'usr_admin_master',
    email: 'admin@omnipost.io',
    name: 'Admin',
    role: 'admin',
    password: 'admin123',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  };

  const defaultUser: User = {
    id: 'usr_default_master',
    email: 'user@omnipost.io',
    name: 'User',
    role: 'user',
    password: 'user123',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    created_at: new Date().toISOString(),
  };

  const seedLicenses: LicenseKey[] = [
    {
      id: 'lic_starter_ready',
      key: 'OMNI-KEY-1001-ALPHA',
      label: 'Starter Pass (3 Workspaces - 30 Days)',
      max_workspaces: 3,
      validity_days: 30,
      created_at: new Date().toISOString(),
      is_redeemed: false,
      is_revoked: false,
      status: 'available',
    },
  ];

  const proWorkspace: Workspace = {
    id: 'ws_pro_acme',
    name: 'Acme Growth Media',
    slug: 'acme-growth-media',
    plan: 'pro',
    owner_id: defaultUser.id,
    settings: {
      timezone: 'America/New_York',
      max_accounts: 50,
      max_scheduled_posts: 500,
      auto_retry_failed: true,
    },
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const freeWorkspace: Workspace = {
    id: 'ws_free_solo',
    name: 'Solo Creator Lab',
    slug: 'solo-creator-lab',
    plan: 'free',
    owner_id: defaultUser.id,
    settings: {
      timezone: 'America/Los_Angeles',
      max_accounts: 3,
      max_scheduled_posts: 10,
      auto_retry_failed: false,
    },
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const members: WorkspaceMember[] = [
    {
      id: 'mem_1',
      workspace_id: proWorkspace.id,
      user_id: defaultUser.id,
      role: 'owner',
      user: defaultUser,
      joined_at: proWorkspace.created_at,
    },
    {
      id: 'mem_2',
      workspace_id: freeWorkspace.id,
      user_id: defaultUser.id,
      role: 'owner',
      user: defaultUser,
      joined_at: freeWorkspace.created_at,
    },
  ];

  const now = Date.now();

  const accounts: (WorkspaceAccount & { access_token_enc?: string; refresh_token_enc?: string })[] = [
    {
      id: 'acc_x_acme',
      workspace_id: proWorkspace.id,
      platform: 'twitter',
      platform_account_id: 'x_1092837482',
      account_name: 'Acme Media Official',
      account_handle: '@AcmeMediaCorp',
      account_avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      status: 'active',
      token_expires_at: new Date(now + 90 * 86400000).toISOString(),
      metadata: {
        follower_count: 34200,
        verified: true,
        category: 'Media & Tech',
      },
      last_synced_at: new Date(now - 120000).toISOString(),
      created_at: new Date(now - 20 * 86400000).toISOString(),
      updated_at: new Date(now - 120000).toISOString(),
      access_token_enc: 'enc_token_x_prod_live_mock',
      refresh_token_enc: 'enc_refresh_x_prod_live_mock',
    },
    {
      id: 'acc_ig_acme',
      workspace_id: proWorkspace.id,
      platform: 'instagram',
      platform_account_id: 'ig_987234112',
      account_name: 'Acme Visuals',
      account_handle: '@acmegrowth',
      account_avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      status: 'active',
      token_expires_at: new Date(now + 45 * 86400000).toISOString(),
      metadata: {
        follower_count: 89400,
        verified: true,
        category: 'Digital Creator',
      },
      last_synced_at: new Date(now - 300000).toISOString(),
      created_at: new Date(now - 20 * 86400000).toISOString(),
      updated_at: new Date(now - 300000).toISOString(),
      access_token_enc: 'enc_token_ig_prod_live_mock',
      refresh_token_enc: 'enc_refresh_ig_prod_live_mock',
    },
    {
      id: 'acc_li_acme',
      workspace_id: proWorkspace.id,
      platform: 'linkedin',
      platform_account_id: 'li_44829103',
      account_name: 'Acme Growth Media Inc.',
      account_handle: 'company/acme-growth-media',
      account_avatar: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      status: 'expiring_soon',
      token_expires_at: new Date(now + 12 * 3600000).toISOString(), // expires in 12 hours!
      metadata: {
        follower_count: 18200,
        verified: true,
        category: 'Marketing & Advertising',
      },
      last_synced_at: new Date(now - 600000).toISOString(),
      created_at: new Date(now - 15 * 86400000).toISOString(),
      updated_at: new Date(now - 600000).toISOString(),
      access_token_enc: 'enc_token_li_prod_live_mock',
      refresh_token_enc: 'enc_refresh_li_prod_live_mock',
    },
    {
      id: 'acc_fb_acme',
      workspace_id: proWorkspace.id,
      platform: 'facebook',
      platform_account_id: 'fb_page_551029',
      account_name: 'Acme Media Global',
      account_handle: 'fb.com/AcmeGlobalMedia',
      account_avatar: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      status: 'active',
      token_expires_at: new Date(now + 60 * 86400000).toISOString(),
      metadata: {
        page_id: 'fb_page_551029',
        page_name: 'Acme Media Global',
        follower_count: 42300,
        verified: false,
      },
      last_synced_at: new Date(now - 400000).toISOString(),
      created_at: new Date(now - 18 * 86400000).toISOString(),
      updated_at: new Date(now - 400000).toISOString(),
      access_token_enc: 'enc_token_fb_page_prod_mock',
    },
    {
      id: 'acc_yt_acme',
      workspace_id: proWorkspace.id,
      platform: 'youtube',
      platform_account_id: 'yt_UC92837182',
      account_name: 'Acme Tech Shows',
      account_handle: '@AcmeTechShows',
      account_avatar: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      status: 'active',
      token_expires_at: new Date(now + 30 * 86400000).toISOString(),
      metadata: {
        subscriber_count: 125000,
        verified: true,
        category: 'Technology',
      },
      last_synced_at: new Date(now - 800000).toISOString(),
      created_at: new Date(now - 14 * 86400000).toISOString(),
      updated_at: new Date(now - 800000).toISOString(),
      access_token_enc: 'enc_token_yt_prod_mock',
      refresh_token_enc: 'enc_refresh_yt_prod_mock',
    },
  ];

  // Seed rich posts across scheduled, published, and failed states
  const posts: Post[] = [
    {
      id: 'post_sched_1',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: '🚀 Big announcement: We are launching our next-gen automated marketing stack for creators tomorrow! Catch our live breakdown on all channels at 10 AM EST.\n\n#CreatorEconomy #SaaS #Growth',
      media_urls: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['twitter', 'linkedin'],
      target_account_ids: ['acc_x_acme', 'acc_li_acme'],
      status: 'scheduled',
      scheduled_at: new Date(now + 2 * 3600000).toISOString(), // 2 hours from now
      created_at: new Date(now - 3600000).toISOString(),
      updated_at: new Date(now - 3600000).toISOString(),
    },
    {
      id: 'post_sched_2',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: 'Here is what 500 top B2B teams do differently when scaling social distribution in 2026. A detailed breakdown of multi-platform storytelling and cadence.\n\nSwipe through the carousel to see the playbook.',
      media_urls: ['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['instagram', 'facebook', 'linkedin'],
      target_account_ids: ['acc_ig_acme', 'acc_fb_acme', 'acc_li_acme'],
      status: 'scheduled',
      scheduled_at: new Date(now + 24 * 3600000).toISOString(), // Tomorrow
      created_at: new Date(now - 7200000).toISOString(),
      updated_at: new Date(now - 7200000).toISOString(),
    },
    {
      id: 'post_sched_3_due',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: '⚡ Behind the scenes at our creative studio: Testing multi-angle 4K streaming pipelines with zero latency.',
      media_urls: ['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['twitter', 'instagram'],
      target_account_ids: ['acc_x_acme', 'acc_ig_acme'],
      status: 'scheduled',
      scheduled_at: new Date(now - 30000).toISOString(), // Just due! Ready for dispatcher worker
      created_at: new Date(now - 1800000).toISOString(),
      updated_at: new Date(now - 1800000).toISOString(),
    },
    {
      id: 'post_pub_1',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: 'Consistency beats intensity every single time in social growth. Building momentum requires automated delivery and authentic voice.',
      media_urls: ['https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['twitter', 'linkedin', 'facebook'],
      target_account_ids: ['acc_x_acme', 'acc_li_acme', 'acc_fb_acme'],
      status: 'published',
      scheduled_at: new Date(now - 48 * 3600000).toISOString(),
      published_at: new Date(now - 48 * 3600000).toISOString(),
      platform_post_ids: {
        twitter: '189283746192',
        linkedin: 'urn:li:share:721098234',
        facebook: 'fb_post_991823',
      },
      created_at: new Date(now - 50 * 3600000).toISOString(),
      updated_at: new Date(now - 48 * 3600000).toISOString(),
    },
    {
      id: 'post_pub_2',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: 'Deep Dive Episode 12 is out now! How to build scalable distributed cloud engines with real-time analytics. Watch the full 30-min masterclass on our YouTube channel.',
      media_urls: ['https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['youtube', 'twitter'],
      target_account_ids: ['acc_yt_acme', 'acc_x_acme'],
      status: 'published',
      scheduled_at: new Date(now - 96 * 3600000).toISOString(),
      published_at: new Date(now - 96 * 3600000).toISOString(),
      platform_post_ids: {
        youtube: 'yt_vid_abc1234',
        twitter: '189112233445',
      },
      created_at: new Date(now - 100 * 3600000).toISOString(),
      updated_at: new Date(now - 96 * 3600000).toISOString(),
    },
    {
      id: 'post_failed_1',
      workspace_id: proWorkspace.id,
      author_id: defaultUser.id,
      author_name: defaultUser.name,
      content: 'Exclusive sneak peek at our upcoming Q4 brand visual identity refresh. High-fidelity motion renders incoming!',
      media_urls: ['https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1200&auto=format&fit=crop&q=80'],
      media_type: 'image',
      target_platforms: ['linkedin'],
      target_account_ids: ['acc_li_acme'],
      status: 'failed',
      scheduled_at: new Date(now - 12 * 3600000).toISOString(),
      error_message: 'LinkedIn OAuth token expired (code 401). Token refresh failed because the grant was revoked or expired.',
      error_details: {
        platform: 'linkedin',
        code: 'TOKEN_EXPIRED_REAUTH_REQUIRED',
        actionable_remedy: 'Go to Workspace Accounts and click "Re-authenticate" on LinkedIn to refresh credentials.',
        raw_error: 'HTTP 401 Unauthorized: Invalid or expired access token for URN urn:li:organization:44829103',
      },
      created_at: new Date(now - 15 * 3600000).toISOString(),
      updated_at: new Date(now - 12 * 3600000).toISOString(),
    },
  ];

  const post_analytics: PostAnalytics[] = [
    {
      id: 'ana_1',
      post_id: 'post_pub_1',
      impressions: 48920,
      reach: 34100,
      engagements: 3820,
      likes: 2190,
      retweets_shares: 450,
      comments: 290,
      clicks: 890,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ana_2',
      post_id: 'post_pub_2',
      impressions: 112400,
      reach: 89000,
      engagements: 14200,
      likes: 8400,
      retweets_shares: 1950,
      comments: 1100,
      clicks: 2750,
      updated_at: new Date().toISOString(),
    },
  ];

  const dispatch_logs: DispatchLog[] = [
    {
      id: 'log_1',
      workspace_id: proWorkspace.id,
      post_id: 'post_pub_1',
      post_title: 'Consistency beats intensity every single time...',
      workspace_account_id: 'acc_x_acme',
      account_handle: '@AcmeMediaCorp',
      platform: 'twitter',
      status: 'success',
      payload_preview: {
        content_length: 128,
        has_media: true,
        media_type: 'image',
      },
      execution_time_ms: 412,
      created_at: new Date(now - 48 * 3600000).toISOString(),
    },
    {
      id: 'log_2',
      workspace_id: proWorkspace.id,
      post_id: 'post_pub_1',
      post_title: 'Consistency beats intensity every single time...',
      workspace_account_id: 'acc_li_acme',
      account_handle: 'company/acme-growth-media',
      platform: 'linkedin',
      status: 'success',
      payload_preview: {
        content_length: 128,
        has_media: true,
        media_type: 'image',
      },
      execution_time_ms: 530,
      created_at: new Date(now - 48 * 3600000 + 1000).toISOString(),
    },
    {
      id: 'log_3',
      workspace_id: proWorkspace.id,
      post_id: 'post_failed_1',
      post_title: 'Exclusive sneak peek at our upcoming Q4 brand...',
      workspace_account_id: 'acc_li_acme',
      account_handle: 'company/acme-growth-media',
      platform: 'linkedin',
      status: 'failure',
      error_code: 'AUTH_401_TOKEN_EXPIRED',
      error_message: 'LinkedIn OAuth token expired. Please re-authenticate your LinkedIn account.',
      payload_preview: {
        content_length: 115,
        has_media: true,
        media_type: 'image',
      },
      execution_time_ms: 289,
      created_at: new Date(now - 12 * 3600000).toISOString(),
    },
  ];

  return {
    users: [adminUser, defaultUser],
    workspaces: [],
    license_keys: seedLicenses,
    workspace_members: [],
    workspace_accounts: [],
    posts: [],
    post_analytics: [],
    dispatch_logs: [],
  };
}

class DatabaseManager {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  public readonly ready: Promise<void>;

  constructor() {
    this.data = this.loadData();
    this.ready = this.initializePersistence();
  }

  private async initializePersistence(): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('[OmniPost] Supabase is not configured; using in-memory seed data.');
      return;
    }

    try {
      const [users, passwords, workspaces, licenses, members, accounts, posts, analytics, logs] =
        await Promise.all([
          readTable<any>('users'),
          readTable<any>('app_passwords'),
          readTable<any>('workspaces'),
          readTable<any>('licenses'),
          readTable<any>('workspace_members'),
          readTable<any>('workspace_accounts'),
          readTable<any>('posts'),
          readTable<any>('post_analytics'),
          readTable<any>('dispatch_logs'),
        ]);

      const passwordMap = new Map(passwords.map((p: any) => [p.user_id, p.password_hash]));
      this.data = {
        users: users.map((u: any) => ({
          id: u.id,
          email: u.email || '',
          name: u.display_name || '',
          role: u.role === 'admin' ? 'admin' : 'user',
          avatar_url: undefined,
          active_license_id: u.active_license_key || undefined,
          created_at: u.created_at || new Date().toISOString(),
          password_hash: passwordMap.get(u.id),
        })) as any,
        workspaces: workspaces.map((w: any) => ({
          id: w.id,
          name: w.name,
          slug: w.slug || w.id,
          plan: ['free','pro','enterprise'].includes(w.plan) ? w.plan : 'free',
          owner_id: w.user_id,
          is_locked: Boolean(w.is_locked),
          settings: w.settings || {},
          created_at: w.created_at,
          updated_at: w.updated_at || w.created_at,
        })),
        license_keys: licenses.map((l: any) => ({
          id: l.id,
          key: l.key,
          label: l.key,
          max_workspaces: l.max_workspaces || 1,
          validity_days: l.duration_in_days || 30,
          created_at: l.created_at,
          activated_at: l.activated_at || undefined,
          expires_at: l.expires_at || undefined,
          is_redeemed: Boolean(l.assigned_to_user_id),
          redeemed_by_user_id: l.assigned_to_user_id || undefined,
          is_revoked: l.status === 'revoked',
          revoked_at: undefined,
          status: l.status === 'revoked' ? 'revoked' : (l.expires_at && new Date(l.expires_at) < new Date() ? 'expired' : (l.assigned_to_user_id ? 'active' : 'available')),
        })),
        workspace_members: members.map((m: any) => ({
          id: m.id,
          workspace_id: m.workspace_id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
        })),
        workspace_accounts: accounts.map((a: any) => ({
          id: a.id,
          workspace_id: a.workspace_id,
          platform: a.provider,
          platform_account_id: a.platform_account_id || a.account_id || a.id,
          account_name: a.account_name,
          account_handle: a.account_handle || a.account_id || a.account_name,
          account_avatar: undefined,
          is_active: Boolean(a.is_connected),
          status: a.status || (a.is_connected ? 'active' : 'revoked'),
          token_expires_at: a.token_expires_at || undefined,
          metadata: a.metadata || {},
          last_synced_at: a.last_synced_at || undefined,
          created_at: a.created_at,
          updated_at: a.updated_at,
          access_token_enc: a.access_token,
          refresh_token_enc: a.refresh_token,
        })),
        posts: posts.map((p: any) => ({
          id: p.id,
          workspace_id: p.workspace_id,
          author_id: p.author_id || undefined,
          content: p.content || '',
          media_urls: p.media_urls || [],
          media_type: p.media_type || 'none',
          target_platforms: p.platforms || [],
          target_account_ids: p.target_account_ids || [],
          status: p.status || 'draft',
          scheduled_at: p.scheduled_time || undefined,
          published_at: p.published_at || undefined,
          error_message: p.error_message || undefined,
          error_details: p.error_details || undefined,
          platform_post_ids: p.platform_post_ids || {},
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
        })),
        post_analytics: analytics.map((a: any) => ({ ...a })),
        dispatch_logs: logs.map((l: any) => ({ ...l })),
      };

      // Keep an empty Supabase project empty; never create fixed demo admins or license keys.

      console.log(`[OmniPost] Loaded Supabase backend: ${this.data.users.length} users, ${this.data.workspaces.length} workspaces, ${this.data.posts.length} posts.`);
    } catch (error) {
      console.error('[OmniPost] Supabase initialization failed:', error);
      throw error;
    }
  }

  private async persistToSupabase(snapshot: DatabaseSchema): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const users = snapshot.users.map((u: any) => ({
      id: u.id,
      email: u.email,
      display_name: u.name,
      role: u.role,
      active_license_key: u.active_license_id || null,
      max_workspaces: 0,
      created_at: u.created_at,
    }));

    const passwords = snapshot.users
      .filter((u: any) => u.password_hash || u.password)
      .map((u: any) => ({
        user_id: u.id,
        password_hash: u.password_hash || hashPassword(u.password),
        updated_at: new Date().toISOString(),
      }));

    const licenses = snapshot.license_keys.map((l: any) => ({
      id: l.id,
      key: l.key,
      duration_in_days: l.validity_days,
      status: l.is_revoked ? 'revoked' : l.status,
      assigned_to_user_id: l.redeemed_by_user_id || null,
      created_at: l.created_at,
      activated_at: l.activated_at || null,
      expires_at: l.expires_at || null,
      max_workspaces: l.max_workspaces,
    }));

    const workspaces = snapshot.workspaces.map((w: any) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      user_id: w.owner_id,
      is_locked: Boolean(w.is_locked),
      connected_accounts: [],
      plan: w.plan,
      settings: w.settings || {},
      created_at: w.created_at,
      updated_at: w.updated_at,
    }));

    const members = snapshot.workspace_members.map((m: any) => ({
      id: m.id,
      workspace_id: m.workspace_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
    }));

    const accounts = snapshot.workspace_accounts.map((a: any) => ({
      id: a.id,
      workspace_id: a.workspace_id,
      provider: a.platform,
      account_name: a.account_name,
      account_id: a.platform_account_id,
      platform_account_id: a.platform_account_id,
      account_handle: a.account_handle,
      access_token: a.access_token_enc || null,
      refresh_token: a.refresh_token_enc || null,
      token_expires_at: a.token_expires_at || null,
      is_connected: Boolean(a.is_active),
      status: a.status,
      metadata: a.metadata || {},
      last_synced_at: a.last_synced_at || null,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));

    const posts = snapshot.posts.map((p: any) => ({
      id: p.id,
      workspace_id: p.workspace_id,
      author_id: p.author_id || null,
      content: p.content,
      scheduled_time: p.scheduled_at || null,
      status: p.status,
      media_urls: p.media_urls || [],
      platforms: p.target_platforms || [],
      target_account_ids: p.target_account_ids || [],
      media_type: p.media_type || 'none',
      published_at: p.published_at || null,
      error_message: p.error_message || null,
      error_details: p.error_details || null,
      platform_post_ids: p.platform_post_ids || {},
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    await replaceRows('post_analytics', []);
    await replaceRows('dispatch_logs', []);
    await replaceRows('posts', []);
    await replaceRows('workspace_accounts', []);
    await replaceRows('workspace_members', []);
    await replaceRows('licenses', []);
    await replaceRows('workspaces', []);
    await replaceRows('app_passwords', []);
    await replaceRows('users', []);

    await replaceRows('users', users);
    await replaceRows('app_passwords', passwords);
    await replaceRows('licenses', licenses);
    await replaceRows('workspaces', workspaces);
    await replaceRows('workspace_members', members);
    await replaceRows('workspace_accounts', accounts);
    await replaceRows('posts', posts);
    await replaceRows('post_analytics', snapshot.post_analytics);
    await replaceRows('dispatch_logs', snapshot.dispatch_logs);
  }

  public resetAllData(): DatabaseSchema {
    const seed = getInitialSeed();
    this.data = seed;
    this.save();
    return this.data;
  }

  private loadData(): DatabaseSchema {
    return getInitialSeed();
  }

  private persistSync(_data: DatabaseSchema) {
    // Supabase is the source of truth. This method remains for backwards compatibility.
  }

  public save() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify(this.data)) as DatabaseSchema;
      this.persistToSupabase(snapshot).catch((error) => {
        console.error('[OmniPost] Failed to persist to Supabase:', error);
      });
    }, 150);
  }

  // ================= USERS & AUTH =================
  public getUsers(): User[] {
    return this.data.users.map(({ password, password_hash, ...u }: any) => u as User);
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public async authenticate(email: string, password?: string): Promise<{ user?: User; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!password) return { error: 'Password is required' };

    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error || !data.user) {
        return { error: 'Invalid email or password. Please check your credentials.' };
      }

      const authUser = data.user;
      let user = this.data.users.find((candidate) => candidate.id === authUser.id)
        || this.getUserByEmail(normalizedEmail);

      if (!user) {
        user = {
          id: authUser.id,
          email: authUser.email || normalizedEmail,
          name: authUser.user_metadata?.display_name || normalizedEmail.split('@')[0],
          role: 'user',
          created_at: authUser.created_at || new Date().toISOString(),
        };
        this.data.users.push(user);
        this.save();
      }

      const { password: _, password_hash: __, ...cleanUser } = user as any;
      return { user: cleanUser as User };
    }

    const user = this.getUserByEmail(normalizedEmail) as (User & { password_hash?: string }) | undefined;
    if (!user) return { error: 'Account not found with this email address' };

    const localHash = (user as any).password_hash || user.password;
    if (!localHash || !verifyPassword(password, localHash)) {
      return { error: 'Invalid email or password. Please check your credentials.' };
    }

    const { password: _, password_hash: __, ...cleanUser } = user as any;
    return { user: cleanUser as User };
  }

  public async registerUser(name: string, email: string, password: string = 'user123', _role?: 'admin' | 'user'): Promise<{ user?: User; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (this.getUserByEmail(normalizedEmail)) {
      return { error: 'An account with this email already exists' };
    }

    let userId: string = crypto.randomUUID();

    // Create the identity in Supabase Auth when the project is configured.
    // The public.users row is then keyed by the Auth user UUID.
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase().auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: name.trim() },
      });
      if (error || !data.user) {
        return { error: error?.message || 'Unable to create authentication account' };
      }
      userId = data.user.id;
    }

    const newUser: any = {
      id: userId,
      email: normalizedEmail,
      name: name.trim(),
      role: 'user',
      password_hash: hashPassword(password),
      created_at: new Date().toISOString(),
    };

    this.data.users.push(newUser);
    this.save();
    const { password: _, password_hash: __, ...clean } = newUser as any;
    return { user: clean as User };
  }

  public updateUserProfile(id: string, updates: Partial<User>): User | null {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    if (updates.name) user.name = updates.name.trim();
    if (updates.email) user.email = updates.email.trim().toLowerCase();
    if (updates.password) (user as any).password_hash = hashPassword(updates.password);
    if (updates.avatar_url) user.avatar_url = updates.avatar_url;
    this.save();
    const { password: _, password_hash: __, ...clean } = user as any;
    return clean as User;
  }

  // ================= LICENSE KEYS & ACTIVATION =================
  public getLicenseKeys(): LicenseKey[] {
    const now = Date.now();
    // Update expired statuses dynamically
    this.data.license_keys.forEach((k) => {
      if (!k.is_revoked && k.is_redeemed && k.expires_at) {
        if (new Date(k.expires_at).getTime() < now) {
          k.status = 'expired';
        } else {
          k.status = 'active';
        }
      } else if (k.is_revoked) {
        k.status = 'revoked';
      } else if (!k.is_redeemed) {
        k.status = 'available';
      }
    });
    return this.data.license_keys;
  }

  public createLicenseKey(data: {
    label: string;
    max_workspaces: number;
    validity_days: number;
    custom_key?: string;
  }): LicenseKey {
    // Generate clean license code e.g. OMNI-8F32-K921-X014
    const randomHex = () => crypto.randomBytes(4).toString('hex').toUpperCase();
    const generatedKey = data.custom_key?.trim() || `OMNI-${randomHex()}-${randomHex()}-${randomHex()}`;

    const newKey: LicenseKey = {
      id: crypto.randomUUID(),
      key: generatedKey.toUpperCase(),
      label: data.label.trim() || `License (${data.max_workspaces} Workspaces)`,
      max_workspaces: Math.max(1, Number(data.max_workspaces) || 1),
      validity_days: Math.max(1, Number(data.validity_days) || 30),
      created_at: new Date().toISOString(),
      is_redeemed: false,
      is_revoked: false,
      status: 'available',
    };

    this.data.license_keys.unshift(newKey);
    this.save();
    return newKey;
  }

  public revokeLicenseKey(licenseId: string): { success: boolean; key?: LicenseKey; error?: string } {
    const key = this.data.license_keys.find((k) => k.id === licenseId);
    if (!key) return { success: false, error: 'License key not found' };

    key.is_revoked = true;
    key.revoked_at = new Date().toISOString();
    key.status = 'revoked';

    // If key was assigned to a user, lock that user's workspaces
    if (key.redeemed_by_user_id) {
      const user = this.data.users.find((u) => u.id === key.redeemed_by_user_id);
      if (user && user.active_license_id === key.id) {
        // Lock all workspaces owned by this user
        this.data.workspaces.forEach((w) => {
          if (w.owner_id === user.id) {
            w.is_locked = true;
          }
        });
      }
    }

    this.save();
    return { success: true, key };
  }

  public deleteLicenseKey(licenseId: string): boolean {
    const initialLen = this.data.license_keys.length;
    this.data.license_keys = this.data.license_keys.filter((k) => k.id !== licenseId);
    if (this.data.license_keys.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public redeemLicenseKey(
    userId: string,
    rawKey: string
  ): {
    success: boolean;
    error?: string;
    key?: LicenseKey;
    requires_workspace_selection?: boolean;
    allowed_workspaces?: number;
    total_workspaces?: number;
  } {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    const cleanCode = rawKey.trim().toUpperCase();
    const license = this.data.license_keys.find((k) => k.key.toUpperCase() === cleanCode);

    if (!license) {
      return { success: false, error: 'Invalid license key. Please check the code and try again.' };
    }
    if (license.is_revoked) {
      return { success: false, error: 'This license key has been revoked by administration.' };
    }
    if (license.is_redeemed) {
      return { success: false, error: `This license key was already redeemed on ${new Date(license.activated_at || '').toLocaleDateString()}.` };
    }

    const now = Date.now();
    const expiresAt = new Date(now + license.validity_days * 86400000).toISOString();

    license.is_redeemed = true;
    license.redeemed_by_user_id = user.id;
    license.redeemed_by_user_email = user.email;
    license.activated_at = new Date().toISOString();
    license.expires_at = expiresAt;
    license.status = 'active';

    user.active_license_id = license.id;

    // WORKSPACE QUOTA & LOCK EVALUATION:
    // If user already owns more workspaces than this license allows,
    // lock all except the first N allowed, and flag that user must choose!
    const userWorkspaces = this.data.workspaces.filter((w) => w.owner_id === user.id);
    let requiresSelection = false;

    if (userWorkspaces.length > license.max_workspaces) {
      requiresSelection = true;
      // Keep only first license.max_workspaces unlocked, lock the rest
      userWorkspaces.forEach((w, idx) => {
        w.is_locked = idx >= license.max_workspaces;
      });
    } else {
      // User has enough quota: unlock all user workspaces
      userWorkspaces.forEach((w) => {
        w.is_locked = false;
      });
    }

    this.save();
    return {
      success: true,
      key: license,
      requires_workspace_selection: requiresSelection,
      allowed_workspaces: license.max_workspaces,
      total_workspaces: userWorkspaces.length,
    };
  }

  public getUserLicenseStatus(userId: string) {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return { has_license: false, allowed_workspaces: 0 };

    if (user.role === 'admin') {
      return {
        has_license: true,
        is_admin: true,
        allowed_workspaces: 9999,
        active_workspaces_count: this.data.workspaces.length,
        total_workspaces_count: this.data.workspaces.length,
        days_left: 9999,
        license: {
          label: 'Admin Unlimited Pass',
          max_workspaces: 9999,
          validity_days: 9999,
          status: 'active',
        },
      };
    }

    let activeKey: LicenseKey | undefined;
    if (user.active_license_id) {
      activeKey = this.data.license_keys.find((k) => k.id === user.active_license_id);