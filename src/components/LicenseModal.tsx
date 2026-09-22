import React, { useState } from 'react';
import {
  Key,
  X,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Lock,
  Unlock,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Workspace, User } from '../types';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  workspaces: Workspace[];
  licenseStatus: {
    has_license: boolean;
    license?: any;
    allowed_workspaces: number;
    active_workspaces_count: number;
    total_workspaces_count: number;
    is_expired?: boolean;
    is_revoked?: boolean;
    days_left?: number;
  } | null;
  onRefreshData: () => Promise<void>;
  forceWorkspaceSelection?: boolean;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  workspaces,
  licenseStatus,
  onRefreshData,
  forceWorkspaceSelection = false,
}) => {
  const [keyCode, setKeyCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Workspace Allocation State
  const [isAllocating, setIsAllocating] = useState(forceWorkspaceSelection);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>(() => {
    // Default to unlocked workspaces
    return workspaces.filter((w) => !w.is_locked).map((w) => w.id);
  });
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);

  if (!isOpen) return null;

  const allowedLimit = licenseStatus?.allowed_workspaces || 1;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyCode.trim()) return;

    setIsRedeeming(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/users/${currentUser.id}/redeem-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to activate license key.');
        return;
      }

      setSuccessMsg(`License "${data.key.label}" activated! Allowed workspaces: ${data.allowed_workspaces}.`);
      setKeyCode('');
      await onRefreshData();

      // If user has more workspaces than the new key allows:
      // "agr user k ps already workspaces thy or wo renew krega apne license ko new key se or new mein quantity kam hogi to is soorat mein usko license k hisaab se apne workspaces ko select krna hoga jo wo on krna chahta bakio pr lock ajaye ga"
      if (data.requires_workspace_selection) {
        setIsAllocating(true);
        // Pre-select up to data.allowed_workspaces
        setSelectedWorkspaceIds(workspaces.slice(0, data.allowed_workspaces).map((w) => w.id));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error redeeming key.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleToggleWorkspace = (id: string) => {
    if (selectedWorkspaceIds.includes(id)) {
      setSelectedWorkspaceIds(selectedWorkspaceIds.filter((item) => item !== id));
    } else {
      if (selectedWorkspaceIds.length >= allowedLimit) {
        setErrorMsg(`Your license allows maximum ${allowedLimit} active workspace(s). Uncheck another workspace first.`);
        return;
      }
      setErrorMsg('');
      setSelectedWorkspaceIds([...selectedWorkspaceIds, id]);
    }
  };

  const handleSaveActiveAllocation = async () => {
    setIsSavingAllocation(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/users/${currentUser.id}/select-active-workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeWorkspaceIds: selectedWorkspaceIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to update workspace allocation.');
        return;
      }
      await onRefreshData();
      setIsAllocating(false);
      setSuccessMsg('Workspace allocation saved! Unselected workspaces have been safely locked.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating allocation.');
    } finally {
      setIsSavingAllocation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">License & Workspace Quota Manager</h2>
              <p className="text-[11px] text-zinc-400">Redeem license keys & manage active workspace allocations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Messages */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current License Card */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Current Active License
              </span>
              {licenseStatus?.is_revoked ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  Revoked
                </span>
              ) : licenseStatus?.is_expired ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Expired
                </span>
              ) : licenseStatus?.has_license ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  No Active License
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <div className="text-[10px] text-zinc-500">Allowed Workspaces</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">
                  {licenseStatus?.allowed_workspaces || 0}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500">Active / Total Workspaces</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">
                  {licenseStatus?.active_workspaces_count || 0} / {licenseStatus?.total_workspaces_count || 0}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500">Validity Remaining</div>
                <div className="text-base font-bold text-blue-400 mt-0.5 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{licenseStatus?.days_left || 0} Days</span>
                </div>
              </div>
            </div>

            {licenseStatus?.license?.label && (
              <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
                Plan: <strong className="text-zinc-200">{licenseStatus.license.label}</strong>
              </div>
            )}
          </div>

          {/* WORKSPACE SELECTION SECTION */}
          {/* "agr user k ps already workspaces thy or wo renew krega apne license ko new key se or new mein quantity kam hogi to is soorat mein usko license k hisaab se apne workspaces ko select krna hoga jo wo on krna chahta bakio pr lock ajaye ga" */}
          {isAllocating ? (
            <div className="space-y-4 p-4 rounded-xl bg-blue-950/20 border border-blue-500/30">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-zinc-100 text-xs">
                    Select Workspaces to Activate ({selectedWorkspaceIds.length} / {allowedLimit} selected)
                  </h3>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Your license allows exactly <strong>{allowedLimit}</strong> active workspace(s). Please choose
                    which workspaces you want active. All other unselected workspaces will be safely locked.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {workspaces.map((ws) => {
                  const isChecked = selectedWorkspaceIds.includes(ws.id);
                  return (
                    <div
                      key={ws.id}
                      onClick={() => handleToggleWorkspace(ws.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-blue-600/10 border-blue-500/50 text-zinc-100 shadow-sm'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-700 bg-zinc-900'
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-200">{ws.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {ws.stats?.connected_accounts || 0} channels • {ws.stats?.scheduled_posts_count || 0} queued posts
                          </div>
                        </div>
                      </div>

                      <div>
                        {isChecked ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Unlock className="h-3 w-3" />
                            Active (Unlocked)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <Lock className="h-3 w-3" />
                            Will be Locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocating(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveActiveAllocation}
                  disabled={isSavingAllocation || selectedWorkspaceIds.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{isSavingAllocation ? 'Saving...' : 'Apply Workspace Allocation'}</span>
                </button>
              </div>
            </div>
          ) : (
            workspaces.length > 1 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div>
                  <div className="font-medium text-zinc-200">Manage Workspace Locking</div>
                  <div className="text-[11px] text-zinc-400">
                    Switch which workspaces are unlocked within your {allowedLimit} slot quota
                  </div>
                </div>
                <button
                  onClick={() => setIsAllocating(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                >
                  Configure Allocation
                </button>
              </div>
            )
          )}

          {/* Redeem New License Key Section */}
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-zinc-100 flex items-center gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Redeem / Renew License Key</span>
            </h3>

            <form onSubmit={handleRedeem} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  placeholder="Enter license code (e.g. OMNI-GROW-9821-X4K9)"
                  required
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 uppercase tracking-wider text-xs"
                />
                <button
                  type="submit"
                  disabled={isRedeeming || !keyCode.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <span>{isRedeeming ? 'Validating...' : 'Activate'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
