-- =====================================================================
-- OMNIPOST: PRODUCTION MULTI-TENANT SOCIAL MEDIA SCHEDULING SAAS
-- PostgreSQL / Supabase Migration Schema with Row Level Security (RLS)
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE workspace_plan AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE social_platform AS ENUM ('instagram', 'facebook', 'twitter', 'linkedin', 'youtube');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'expiring_soon', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE media_type AS ENUM ('none', 'image', 'video', 'carousel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    password_hash TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE
);


-- 4A. LICENSE KEYS (application licensing layer)
CREATE TABLE IF NOT EXISTS license_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    max_workspaces INT NOT NULL,
    validity_days INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    redeemed_by_user_email TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'available'
);

-- 4. WORKSPACES TABLE (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan workspace_plan NOT NULL DEFAULT 'free',
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{"timezone": "UTC", "max_accounts": 3, "max_scheduled_posts": 10}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. WORKSPACE MEMBERS TABLE (RBAC)
CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'editor',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

-- 6. WORKSPACE ACCOUNTS (Connected Social Media Channels)
CREATE TABLE IF NOT EXISTS workspace_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    platform_account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_handle TEXT NOT NULL,
    account_avatar TEXT,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    status account_status NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, platform, platform_account_id)
);

-- 7. POSTS TABLE (Draft, Scheduled, Published)
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    media_type media_type NOT NULL DEFAULT 'none',
    target_platforms TEXT[] NOT NULL DEFAULT '{}',
    target_account_ids TEXT[] NOT NULL DEFAULT '{}',
    status post_status NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    error_message TEXT,
    error_details JSONB,
    platform_post_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. POST ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS post_analytics (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    workspace_account_id TEXT NOT NULL REFERENCES workspace_accounts(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    impressions INT NOT NULL DEFAULT 0,
    reach INT NOT NULL DEFAULT 0,
    engagements INT NOT NULL DEFAULT 0,
    likes INT NOT NULL DEFAULT 0,
    retweets_shares INT NOT NULL DEFAULT 0,
    comments INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, workspace_account_id)
);

-- 9. DISPATCH WORKER LOGS
CREATE TABLE IF NOT EXISTS dispatch_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
    workspace_account_id TEXT REFERENCES workspace_accounts(id) ON DELETE SET NULL,
    platform social_platform NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failure', 'rate_limited'
    error_code TEXT,
    error_message TEXT,
    payload_preview JSONB,
    execution_time_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INDEXES FOR HIGH-THROUGHPUT POLLING & MULTI-TENANCY
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_ws ON workspace_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_status ON workspace_accounts(status);
CREATE INDEX IF NOT EXISTS idx_posts_ws_status ON posts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_worker ON posts(status, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_post_analytics_post ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_ws ON dispatch_logs(workspace_id, created_at DESC);

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current authenticated user belongs to workspace
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Workspaces policy
CREATE POLICY "Users can access workspaces they belong to"
ON workspaces FOR ALL
USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- Workspace Accounts policy
CREATE POLICY "Members can access workspace channels"
ON workspace_accounts FOR ALL
USING (is_workspace_member(workspace_id));

-- Posts policy
CREATE POLICY "Members can access workspace posts"
ON posts FOR ALL
USING (is_workspace_member(workspace_id));

-- Analytics policy
CREATE POLICY "Members can access workspace post analytics"
ON post_analytics FOR ALL
USING (
    post_id IN (
        SELECT id FROM posts WHERE is_workspace_member(workspace_id)
    )
);

-- Dispatch logs policy
CREATE POLICY "Members can view workspace dispatch logs"
ON dispatch_logs FOR SELECT
USING (is_workspace_member(workspace_id));
