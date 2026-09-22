import React, { useState } from 'react';
import { X, Building2, Check, Sparkles, AlertTriangle, Key } from 'lucide-react';
import { WorkspacePlan } from '../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, plan: WorkspacePlan, timezone: string) => Promise<void>;
  licenseStatus?: {
    has_license: boolean;
    allowed_workspaces: number;
    active_workspaces_count: number;
    is_admin?: boolean;
  } | null;
  onOpenLicenseModal?: () => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  licenseStatus,
  onOpenLicenseModal,
}) => {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<WorkspacePlan>('pro');
  const [timezone, setTimezone] = useState('America/New_York');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isQuotaFull =
    !licenseStatus?.is_admin &&
    licenseStatus &&
    licenseStatus.active_workspaces_count >= licenseStatus.allowed_workspaces;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    if (isQuotaFull) {
      setError(
        `License limit reached: You have ${licenseStatus?.active_workspaces_count} active workspace(s) which meets your license limit of ${licenseStatus?.allowed_workspaces}. Upgrade your license key to add more.`
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), plan, timezone);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div
        id="workspace-create-modal"
        className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Create New Workspace</h3>
              <p className="text-xs text-zinc-400">Multi-tenant isolation for brands, clients, or teams</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* License Quota Banner */}
        {licenseStatus && !licenseStatus.is_admin && (
          <div
            className={`mb-5 p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              isQuotaFull
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-zinc-950 border-zinc-800 text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isQuotaFull ? (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <Key className="h-4 w-4 text-blue-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold">License Workspace Quota: </span>
                <span>
                  {licenseStatus.active_workspaces_count} / {licenseStatus.allowed_workspaces} slots used
                </span>
                {isQuotaFull && (
                  <div className="text-[11px] text-amber-400/90 mt-0.5">
                    No available workspace slots remaining on your current key.
                  </div>
                )}
              </div>
            </div>

            {onOpenLicenseModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLicenseModal();
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors shrink-0"
              >
                Manage Key
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Workspace / Client Name
            </label>
            <input
              id="ws-name-input"
              type="text"
              placeholder="e.g. Velocity Media Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Select Workspace Plan
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Free Plan */}
              <div
                onClick={() => setPlan('free')}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  plan === 'free'
                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-zinc-200">Free Tier</span>
                  {plan === 'free' && <Check className="h-4 w-4 text-blue-400" />}
                </div>
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>• Max 3 Connected Channels</p>
                  <p>• 10 Scheduled Posts Queue</p>
                  <p>• Standard Dispatch</p>
                </div>
              </div>

              {/* Pro Plan */}
              <div
                onClick={() => setPlan('pro')}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  plan === 'pro'
                    ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-zinc-100">Pro Agency</span>
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  {plan === 'pro' && <Check className="h-4 w-4 text-violet-400" />}
                </div>
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>• 50 Connected Channels</p>
                  <p>• 500 Scheduled Posts</p>
                  <p>• Auto-Retry & Error Recovery</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Default Scheduling Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="America/New_York">America/New_York (EST / EDT)</option>
              <option value="America/Chicago">America/Chicago (CST / CDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
              <option value="Europe/London">Europe/London (GMT / BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="UTC">Universal Time Coordinated (UTC)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
