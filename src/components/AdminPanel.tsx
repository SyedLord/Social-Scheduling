import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  ShieldCheck,
  Ban,
  Trash2,
  Copy,
  Check,
  Clock,
  Building2,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  UserCheck,
  Edit3,
} from 'lucide-react';
import { User, LicenseKey, Workspace } from '../types';

interface AdminPanelProps {
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
  onRefreshWorkspaces: () => Promise<void>;
  workspaces: Workspace[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onUpdateCurrentUser,
  onRefreshWorkspaces,
  workspaces,
}) => {
  const [licenses, setLicenses] = useState<LicenseKey[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'licenses' | 'workspaces' | 'admin_account'>('licenses');

  // License Generator Form
  const [label, setLabel] = useState('');
  const [maxWorkspaces, setMaxWorkspaces] = useState<number>(3);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [customKey, setCustomKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'active' | 'expired' | 'revoked'>('all');

  // Admin Account Settings Form
  const [adminName, setAdminName] = useState(currentUser.name || 'System Administrator');
  const [adminEmail, setAdminEmail] = useState(currentUser.email || 'admin@omnipost.io');
  const [adminPassword, setAdminPassword] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);
  const [accountUpdateError, setAccountUpdateError] = useState('');

  // Fetch licenses and all users
  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [licRes, usersRes] = await Promise.all([
        fetch('/api/admin/licenses'),
        fetch('/api/auth/users'),
      ]);
      const licData = await licRes.json();
      const usersData = await usersRes.json();
      setLicenses(Array.isArray(licData) ? licData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim() || `License (${maxWorkspaces} Workspaces)`,
          max_workspaces: Number(maxWorkspaces),
          validity_days: Number(validityDays),
          custom_key: customKey.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to generate license key');
        return;
      }
      setLabel('');
      setCustomKey('');
      await fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this license key? Any connected user will immediately have their workspaces locked.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/licenses/${id}/revoke`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to revoke key');
        return;
      }
      await fetchAdminData();
      await onRefreshWorkspaces();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this license key permanently?')) return;
    try {
      await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
      await fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Reset all workspaces, posts, and data to clean slate? Admin & user accounts will be kept.')) return;
    try {
      const res = await fetch('/api/admin/reset-database', { method: 'POST' });
      if (res.ok) {
        await fetchAdminData();
        await onRefreshWorkspaces();
        alert('Database has been reset to clean slate successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (keyStr: string, id: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleSaveAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountUpdateError('');
    setAccountUpdateSuccess(false);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAccountUpdateError(data.error || 'Failed to update admin account');
        return;
      }
      onUpdateCurrentUser(data);
      setAccountUpdateSuccess(true);
      setAdminPassword('');
      setTimeout(() => setAccountUpdateSuccess(false), 4000);
    } catch (err: any) {
      setAccountUpdateError(err.message || 'Error updating account');
    }
  };

  // Filtered licenses
  const filteredLicenses = licenses.filter((lic) => {
    const matchesSearch =
      lic.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lic.redeemed_by_user_email && lic.redeemed_by_user_email.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return lic.status === statusFilter;
  });

  const totalKeys = licenses.length;
  const activeKeys = licenses.filter((l) => l.status === 'active').length;
  const availableKeys = licenses.filter((l) => l.status === 'available').length;
  const revokedKeys = licenses.filter((l) => l.status === 'revoked').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-100 tracking-tight">System Admin Control Center</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate license keys, track workspace quotas, assign limits, and enforce account lock rules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDatabase}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/30 border border-red-800/40 hover:bg-red-900/40 text-xs font-medium text-red-300 transition-colors"
            title="Reset all workspaces, posts, and data to clean slate"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset All Data</span>
          </button>
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-1">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'licenses'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Key className="h-4 w-4 text-blue-400" />
          <span>License Keys & Quotas ({totalKeys})</span>
        </button>

        <button
          onClick={() => setActiveTab('workspaces')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'workspaces'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Building2 className="h-4 w-4 text-emerald-400" />
          <span>All Client Workspaces ({workspaces.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('admin_account')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'admin_account'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Edit3 className="h-4 w-4 text-amber-400" />
          <span>Admin Credentials & Security</span>
        </button>
      </div>

      {/* TAB 1: LICENSES */}
      {activeTab === 'licenses' && (
        <div className="space-y-8">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
              <div className="text-zinc-400 text-xs font-medium">Total Keys Created</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{totalKeys}</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
              <div className="text-zinc-400 text-xs font-medium">Active In Use</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{activeKeys}</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
              <div className="text-zinc-400 text-xs font-medium">Unredeemed / Available</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{availableKeys}</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
              <div className="text-zinc-400 text-xs font-medium">Revoked Licenses</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{revokedKeys}</div>
            </div>
          </div>

          {/* Generator Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Generate New License Key</h2>
            </div>

            <form onSubmit={handleGenerateLicense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Label / Client Name / Description
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Acme Marketing Agency (Pro Pass)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Allowed Workspaces Quantity
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={maxWorkspaces}
                      onChange={(e) => setMaxWorkspaces(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMaxWorkspaces(num)}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                            maxWorkspaces === num
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Validity Period (Days)
                  </label>
                  <select
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value={7}>7 Days (Trial)</option>
                    <option value={15}>15 Days</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={60}>60 Days (2 Months)</option>
                    <option value={90}>90 Days (Quarter)</option>
                    <option value={180}>180 Days (Half Year)</option>
                    <option value={365}>365 Days (1 Year)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex-1 max-w-sm">
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                    placeholder="Custom Code (optional, e.g. VIP-2026)"
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Generating...' : 'Generate License Key'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* License Keys List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by key code, label, or user email..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {(['all', 'available', 'active', 'expired', 'revoked'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 font-medium">
                    <th className="py-3 px-4">License Key & Label</th>
                    <th className="py-3 px-4">Workspaces Limit</th>
                    <th className="py-3 px-4">Validity / Expiry</th>
                    <th className="py-3 px-4">Assigned To (User)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                        No license keys found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((lic) => {
                      const isExpired = lic.status === 'expired';
                      const isRevoked = lic.status === 'revoked';
                      const isActive = lic.status === 'active';
                      const isAvailable = lic.status === 'available';

                      return (
                        <tr key={lic.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-zinc-100 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
                                {lic.key}
                              </span>
                              <button
                                onClick={() => handleCopy(lic.key, lic.id)}
                                title="Copy License Key"
                                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                              >
                                {copiedKeyId === lic.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-1">{lic.label}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                              <span className="font-semibold text-zinc-200">
                                {lic.max_workspaces} {lic.max_workspaces === 1 ? 'Workspace' : 'Workspaces'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-zinc-200">{lic.validity_days} Days Total</div>
                              {lic.expires_at ? (
                                <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>Expires {new Date(lic.expires_at).toLocaleDateString()}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-500">Not yet activated</div>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {lic.redeemed_by_user_email ? (
                              <div className="space-y-0.5">
                                <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                                  <UserCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span className="truncate max-w-[150px]">{lic.redeemed_by_user_email}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  Activated {new Date(lic.activated_at || '').toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic text-[11px]">Unassigned</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </span>
                            )}
                            {isAvailable && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Available
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                Expired
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                <Ban className="h-3 w-3" />
                                Revoked
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isRevoked && (
                                <button
                                  onClick={() => handleRevoke(lic.id)}
                                  title="Revoke License (Instantly Locks User Workspaces)"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors text-[11px] font-medium"
                                >
                                  <Ban className="h-3 w-3" />
                                  <span>Revoke</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(lic.id)}
                                title="Delete License Key"
                                className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT WORKSPACES AUDIT */}
      {activeTab === 'workspaces' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Total Workspaces in System:{' '}
              <strong className="text-zinc-100">{workspaces.length}</strong>
            </span>
            <span className="text-zinc-400">
              Active Unlocked:{' '}
              <strong className="text-emerald-400">
                {workspaces.filter((w) => !w.is_locked).length}
              </strong>{' '}
              • Locked under quota:{' '}
              <strong className="text-amber-400">
                {workspaces.filter((w) => w.is_locked).length}
              </strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 font-medium">
                  <th className="py-3 px-4">Workspace Name</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Connected Channels</th>
                  <th className="py-3 px-4">Scheduled / Published</th>
                  <th className="py-3 px-4">Lock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-200">{ws.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{ws.id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {ws.plan}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {ws.stats?.connected_accounts || 0} channels
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {ws.stats?.scheduled_posts_count || 0} queued / {ws.stats?.published_posts_count || 0} live
                    </td>
                    <td className="py-3.5 px-4">
                      {ws.is_locked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Lock className="h-3 w-3" />
                          Locked (Quota Limit)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Unlock className="h-3 w-3" />
                          Active Unlocked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN ACCOUNT SETTINGS */}
      {activeTab === 'admin_account' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Admin Account Credentials</h2>
            <p className="text-xs text-zinc-400 mt-1">
              "ek admin account banado simple jo baad mein change krdunga mein" - You can change the admin username, email, and login password here at any time.
            </p>
          </div>

          {accountUpdateSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Admin credentials updated successfully!</span>
            </div>
          )}

          {accountUpdateError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{accountUpdateError}</span>
            </div>
          )}

          <form onSubmit={handleSaveAdminAccount} className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Admin Display Name</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">Admin Email Address</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">
                New Admin Password (leave blank to keep current)
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/20 transition-all"
              >
                <Check className="h-4 w-4" />
                <span>Save New Admin Credentials</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
