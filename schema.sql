-- OmniPost / Social Scheduler Supabase compatibility migration
-- This project already contains public.users, licenses, workspaces, posts and
-- workspace_accounts. Run this file only against that existing project.

create table if not exists public.app_passwords (
  user_id uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_passwords enable row level security;
revoke all on public.app_passwords from anon, authenticated;

alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.workspaces add column if not exists slug text;
alter table public.workspaces add column if not exists plan text not null default 'free';
alter table public.workspaces add column if not exists settings jsonb not null default '{"timezone":"UTC","max_accounts":3,"max_scheduled_posts":10,"auto_retry_failed":false}'::jsonb;
alter table public.workspaces add column if not exists updated_at timestamptz not null default now();
update public.workspaces set slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') where slug is null;
create unique index if not exists idx_workspaces_slug on public.workspaces(slug);

alter table public.posts add column if not exists author_id uuid references public.users(id) on delete set null;
alter table public.posts add column if not exists media_type text not null default 'none';
alter table public.posts add column if not exists target_account_ids uuid[] not null default '{}';
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists error_message text;
alter table public.posts add column if not exists error_details jsonb;
alter table public.posts add column if not exists platform_post_ids jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists updated_at timestamptz not null default now();

alter table public.workspace_accounts add column if not exists status text not null default 'active';
alter table public.workspace_accounts add column if not exists metadata jsonb not null default '{}';
alter table public.workspace_accounts add column if not exists last_synced_at timestamptz;
alter table public.workspace_accounts add column if not exists platform_account_id text;
update public.workspace_accounts set platform_account_id = account_id where platform_account_id is null;
alter table public.workspace_accounts add column if not exists account_handle text;
update public.workspace_accounts set account_handle = coalesce(account_handle, account_id, account_name) where account_handle is null;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'editor',
  joined_at timestamptz not null default now(),
  unique(workspace_id,user_id)
);
alter table public.workspace_members enable row level security;

create table if not exists public.post_analytics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  workspace_account_id uuid references public.workspace_accounts(id) on delete cascade,
  platform text,
  impressions integer not null default 0,
  reach integer not null default 0,
  engagements integer not null default 0,
  likes integer not null default 0,
  retweets_shares integer not null default 0,
  comments integer not null default 0,
  clicks integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(post_id,workspace_account_id)
);
alter table public.post_analytics enable row level security;

create table if not exists public.dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  workspace_account_id uuid references public.workspace_accounts(id) on delete set null,
  platform text not null,
  status text not null,
  error_code text,
  error_message text,
  payload_preview jsonb,
  execution_time_ms integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.dispatch_logs enable row level security;

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_posts_workspace_status on public.posts(workspace_id,status);
create index if not exists idx_posts_scheduled_worker on public.posts(status,scheduled_time);
create index if not exists idx_workspace_accounts_workspace on public.workspace_accounts(workspace_id);
create index if not exists idx_licenses_assigned_user on public.licenses(assigned_to_user_id);
