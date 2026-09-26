import React, { useState } from 'react';
import {
  PenSquare,
  CalendarDays,
  Share2,
  BarChart3,
  Terminal,
  Building2,
  ChevronDown,
  Plus,
  Sparkles,
  Zap,
  Check,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { Workspace, User } from '../types';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onOpenNewWorkspaceModal: () => void;
  currentUser: User | null;
  licenseStatus: {
    has_license: boolean;
    license?: any;
    allowed_workspaces: number;
    active_workspaces_count: number;
    total_workspaces_count: number;
    days_left?: number;
    is_admin?: boolean;
    is_locked?: boolean;
  } | null;
  onOpenAuthModal: () => void;
  onOpenLicenseModal: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onOpenNewWorkspaceModal,
  currentUser,
  licenseStatus,
  onOpenAuthModal,
  onOpenLicenseModal,
  onLogout,
}) => {
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const navItems = [
    ...(isAdmin
      ? [
          {
            id: 'admin-panel',
            label: 'Admin Panel & Keys',
            icon: ShieldCheck,
            badge: 'Admin',
            isSpecial: true,
          },
        ]
      : []),
    { id: 'composer', label: 'Compose & Schedule', icon: PenSquare, badge: null },
    {
      id: 'calendar',
      label: 'Visual Calendar & Queue',
      icon: CalendarDays,
      count: activeWorkspace?.stats?.scheduled_posts_count,
    },
    {
      id: 'channels',
      label: 'Connected Channels',
      icon: Share2,
      count: activeWorkspace?.stats?.connected_accounts,
    },
    { id: 'analytics', label: 'Analytics & Reach', icon: BarChart3, badge: null },
    {
      id: 'logs',
      label: 'Dispatch Worker & Logs',
      icon: Terminal,
      errorCount: activeWorkspace?.stats?.failed_posts_count,
    },
  ];

  const accountsUsed = activeWorkspace?.stats?.connected_accounts || 0;
  const accountsLimit = activeWorkspace?.settings?.max_accounts || 3;
  const accountsPercent = Math.min(100, Math.round((accountsUsed / accountsLimit) * 100));

  const queueUsed = activeWorkspace?.stats?.scheduled_posts_count || 0;
  const queueLimit = activeWorkspace?.settings?.max_scheduled_posts || 10;
  const queuePercent = Math.min(100, Math.round((queueUsed / queueLimit) * 100));

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between select-none h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="overflow-y-auto">
        <div className="p-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-zinc-100">OmniPost</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  SaaS
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Social Automation Engine</p>
            </div>
          </div>

          {/* Workspace Switcher */}
          <div className="relative mt-4">
            <button
              id="workspace-switcher-btn"
              onClick={() => setIsWsDropdownOpen(!isWsDropdownOpen)}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                activeWorkspace?.is_locked
                  ? 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10'
                  : 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div
                  className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${
                    activeWorkspace?.is_locked
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700/60 text-zinc-300'
                  }`}
                >
                  {activeWorkspace?.is_locked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-zinc-100 truncate flex items-center gap-1.5">
                    <span>{activeWorkspace?.name || 'Select Workspace'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeWorkspace?.is_locked ? (
                      <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-500/10 px-1 rounded border border-amber-500/20">
                        Locked
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium uppercase px-1 rounded bg-zinc-800 text-zinc-400">
                        Standard
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">• {accountsUsed} channels</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isWsDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  <span>Workspaces ({workspaces.length})</span>
                  {!isAdmin && licenseStatus && (
                    <span className="text-[10px] font-normal text-blue-400">
                      {licenseStatus.active_workspaces_count}/{licenseStatus.allowed_workspaces} Active
                    </span>
                  )}
                </div>

                <div className="space-y-1 my-1 max-h-52 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace(ws);
                        setIsWsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                        activeWorkspace?.id === ws.id
                          ? 'bg-blue-600/10 text-blue-400 font-medium'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="truncate text-zinc-200 flex items-center gap-1.5">
                          {ws.is_locked ? (
                            <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                          ) : (
                            <Unlock className="h-3 w-3 text-emerald-400 shrink-0" />
                          )}
                          <span className={ws.is_locked ? 'text-zinc-400' : 'text-zinc-200'}>
                            {ws.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-zinc-500 uppercase">{ws.plan}</span>
                          {ws.is_locked && (
                            <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1 rounded">
                              Quota Locked
                            </span>
                          )}
                        </div>
                      </div>
                      {activeWorkspace?.id === ws.id && (
                        <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-zinc-800 space-y-1">
                  <button
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      onOpenNewWorkspaceModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create New Workspace</span>
                  </button>

                  {!isAdmin && (
                    <button
                      onClick={() => {
                        setIsWsDropdownOpen(false);
                        onOpenLicenseModal();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      <Key className="h-3 w-3 text-amber-400" />
                      <span>Manage License Allocation</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item: any) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? item.isSpecial
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/5'
                      : 'bg-zinc-800/90 text-zinc-100 shadow-sm border border-zinc-700/60'
                    : item.isSpecial
                    ? 'text-amber-400 hover:bg-amber-500/5 hover:text-amber-300 border border-amber-500/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      item.isSpecial
                        ? 'text-amber-400'
                        : isActive
                        ? 'text-blue-400'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400">
                      {item.badge}
                    </span>
                  )}
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                      {item.count}
                    </span>
                  )}
                  {typeof item.errorCount === 'number' && item.errorCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                      {item.errorCount} fail
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quotas & License & User Profile Footer */}
      <div className="p-3 border-t border-zinc-800 space-y-3">
        {/* Client License & Quota Meter */}
        {!isAdmin && licenseStatus && (
          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Key className="h-3 w-3 text-blue-400" />
                <span>Workspaces License</span>
              </div>
              <span className="font-semibold text-zinc-200">
                {licenseStatus.active_workspaces_count} / {licenseStatus.allowed_workspaces}
              </span>
            </div>

            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  licenseStatus.active_workspaces_count >= licenseStatus.allowed_workspaces
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (licenseStatus.active_workspaces_count /
                        (licenseStatus.allowed_workspaces || 1)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-400">
                {licenseStatus.days_left || 0} days remaining
              </span>
              <button
                onClick={onOpenLicenseModal}
                className="text-[10px] font-semibold text-blue-400 hover:text-blue-300"
              >
                Manage Key →
              </button>
            </div>
          </div>
        )}

        {/* User Account Profile & Switcher */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800 transition-colors">
          <div
            onClick={onOpenAuthModal}
            className="flex items-center gap-2.5 overflow-hidden flex-1 cursor-pointer hover:opacity-90"
            title="Switch User Account"
          >
            <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-200 border border-zinc-700 shrink-0">
              {currentUser?.name?.[0] || 'U'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1">
                <span>{currentUser?.name || 'Account'}</span>
                {isAdmin && (
                  <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1 rounded">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 truncate">{currentUser?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="text-[10px] font-medium text-zinc-400 hover:text-zinc-200 px-1.5 py-1 rounded hover:bg-zinc-800"
              title="Switch user"
            >
              Switch
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-red-950/40 transition-colors"
                title="Sign Out / Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Worker Pulse */}
        <div className="flex items-center justify-between px-2 text-[10px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Worker: Polling 10s</span>
          </div>
          <span className="text-[10px] text-zinc-400">Multi-tenant</span>
        </div>
      </div>
    </aside>
  );
};