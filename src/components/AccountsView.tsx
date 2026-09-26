import React, { useState } from 'react';
import {
  Share2,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  Layers,
  X,
} from 'lucide-react';
import { WorkspaceAccount, SocialPlatform, PLATFORM_CONFIGS, Workspace } from '../types';

interface AccountsViewProps {
  workspace: Workspace;
  accounts: WorkspaceAccount[];
  onConnectSandbox: (platform: SocialPlatform, handle?: string) => Promise<void>;
  onDisconnect: (accountId: string) => Promise<void>;
  onRefreshToken: (accountId: string) => Promise<void>;
  onUpgradePlan: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  workspace,
  accounts,
  onConnectSandbox,
  onDisconnect,
  onRefreshToken,
  onUpgradePlan,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customHandle, setCustomHandle] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const platforms: SocialPlatform[] = ['twitter', 'instagram', 'linkedin', 'facebook', 'youtube'];

  const handleOpenConnect = (platform: SocialPlatform) => {
    setSelectedPlatform(platform);
    setCustomHandle('');
    setIsModalOpen(true);
  };

  const handleStartOAuthLive = async (platform: SocialPlatform) => {
    try {
      setLoadingAction(`oauth-${platform}`);
      const res = await fetch(`/api/oauth/${platform}/authorize?workspaceId=${workspace.id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setNotice(`OAuth URL generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setNotice(err.message || 'Failed to initiate OAuth');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConnectInstant = async () => {
    if (!selectedPlatform) return;
    try {
      setLoadingAction('connecting');
      await onConnectSandbox(selectedPlatform, customHandle.trim() || undefined);
      setIsModalOpen(false);
      setNotice(`Connected ${PLATFORM_CONFIGS[selectedPlatform].name} successfully!`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice(err.message || 'Connection failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefresh = async (accId: string) => {
    try {
      setLoadingAction(`refresh-${accId}`);
      await onRefreshToken(accId);
      setNotice('Token refreshed and renewed for 60 days!');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice(err.message || 'Token refresh failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const isAtQuota = accounts.length >= workspace.settings.max_accounts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Share2 className="h-5 w-5 text-blue-400" />
            <span>Connected Channels & OAuth 2.0</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage authenticated platform tokens, permissions, and automated refresh routines for {workspace.name}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900">
            Quota:{' '}
            <span className="font-semibold text-zinc-200">
              {accounts.length} / {workspace.settings.max_accounts}
            </span>{' '}
            channels
          </div>
          {isAtQuota && workspace.plan === 'free' && (
            <button
              onClick={onUpgradePlan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 transition-colors shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Quota</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-300 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-blue-400 hover:text-blue-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grid of Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((plat) => {
          const config = PLATFORM_CONFIGS[plat];
          const connected = accounts.filter((a) => a.platform === plat);
          const hasAccount = connected.length > 0;

          return (
            <div
              key={plat}
              className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 shadow-sm transition-all hover:border-zinc-700/80 hover:bg-zinc-900 flex flex-col justify-between"
            >
              <div>
                {/* Platform Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
                      style={{ backgroundColor: config.color }}
                    >
                      {plat === 'twitter' && 'X'}
                      {plat === 'instagram' && 'IG'}
                      {plat === 'facebook' && 'FB'}
                      {plat === 'linkedin' && 'in'}
                      {plat === 'youtube' && 'YT'}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{config.name}</h3>
                      <p className="text-[11px] text-zinc-400">
                        {hasAccount ? `${connected.length} account connected` : 'Not linked'}
                      </p>
                    </div>
                  </div>

                  {hasAccount ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                      Offline
                    </span>
                  )}
                </div>

                {/* Connected Accounts list under platform */}
                {hasAccount ? (
                  <div className="space-y-3 my-3">
                    {connected.map((acc) => {
                      const isExpiring = acc.status === 'expiring_soon';
                      const isExpired = acc.status === 'expired' || acc.status === 'revoked';

                      return (
                        <div
                          key={acc.id}
                          className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 truncate pr-2">
                              {acc.account_avatar ? (
                                <img
                                  src={acc.account_avatar}
                                  alt={acc.account_name}
                                  className="h-8 w-8 rounded-full object-cover border border-zinc-700"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                                  {acc.account_name.slice(0, 1)}
                                </div>
                              )}
                              <div className="truncate">
                                <div className="text-xs font-semibold text-zinc-200 truncate">
                                  {acc.account_name}
                                </div>
                                <div className="text-[11px] text-zinc-400 truncate">{acc.account_handle}</div>
                              </div>
                            </div>

                            {/* Token Status Badge */}
                            {isExpiring && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                <span>Expiring</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                <span>Expired</span>
                              </span>
                            )}
                          </div>

                          {/* Stats Row */}
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                            <span>
                              {acc.metadata.follower_count
                                ? `${acc.metadata.follower_count.toLocaleString()} followers`
                                : acc.metadata.subscriber_count
                                ? `${acc.metadata.subscriber_count.toLocaleString()} subscribers`
                                : 'Verified Channel'}
                            </span>
                            <div className="flex items-center gap-1">
                              <Shield className="h-3 w-3 text-emerald-400" />
                              <span className="text-[10px] text-zinc-400">OAuth 2.0 PKCE</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => handleRefresh(acc.id)}
                              disabled={loadingAction === `refresh-${acc.id}`}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                              title="Refresh OAuth token before expiration"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${loadingAction === `refresh-${acc.id}` ? 'animate-spin' : ''}`}
                              />
                              <span>Refresh</span>
                            </button>
                            <button
                              onClick={() => onDisconnect(acc.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="my-4 rounded-xl border border-dashed border-zinc-800 p-4 text-center">
                    <p className="text-xs text-zinc-400">No account linked for {config.name}.</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Connect to schedule posts & dispatch analytics.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Connect button */}
              <div className="pt-3 border-t border-zinc-800/80">
                <button
                  disabled={isAtQuota}
                  onClick={() => handleOpenConnect(plat)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    isAtQuota
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{hasAccount ? 'Add Another Channel' : `Connect ${config.name}`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* OAuth Connection Modal */}
      {isModalOpen && selectedPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
                  style={{ backgroundColor: PLATFORM_CONFIGS[selectedPlatform].color }}
                >
                  {selectedPlatform.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    Connect {PLATFORM_CONFIGS[selectedPlatform].name}
                  </h3>
                  <p className="text-xs text-zinc-400">OAuth 2.0 PKCE authentication flow</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Only real provider authorization is offered here. */}
              {/* Option 2: Live Platform OAuth */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Official OAuth authorization
                  </span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-medium">
                    Requires provider setup
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Redirects to the official provider authorization page after its application credentials are configured.
                </p>

                <button
                  onClick={() => handleStartOAuthLive(selectedPlatform)}
                  disabled={loadingAction === `oauth-${selectedPlatform}`}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-2 px-4 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>
                    {loadingAction === `oauth-${selectedPlatform}`
                      ? 'Redirecting...'
                      : `Authorize on ${PLATFORM_CONFIGS[selectedPlatform].name}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};