import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PostComposer } from './components/PostComposer';
import { CalendarView } from './components/CalendarView';
import { QueueListView } from './components/QueueListView';
import { AccountsView } from './components/AccountsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DispatchLogsView } from './components/DispatchLogsView';
import { WorkspaceModal } from './components/WorkspaceModal';
import { PostPreviewModal } from './components/PostPreviewModal';
import { AdminPanel } from './components/AdminPanel';
import { LicenseModal } from './components/LicenseModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
import {
  Workspace,
  WorkspaceAccount,
  Post,
  SocialPlatform,
  WorkspacePlan,
  User,
} from './types';
import {
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  ShieldAlert,
  Key,
  KeyRound,
  ShieldCheck,
  Building2,
  Plus,
  LogOut,
  Share2,
} from 'lucide-react';

export default function App() {
  // Current authenticated user (Admin or Client)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<WorkspaceAccount[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentView, setCurrentView] = useState<string>('calendar');

  const [composerInitialDate, setComposerInitialDate] = useState<string | undefined>(undefined);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // Modals
  const [isNewWsModalOpen, setIsNewWsModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [forceWsSelection, setForceWsSelection] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch Current User
  const fetchCurrentUser = async () => {
    try {
      const storedId = localStorage.getItem('omnipost_active_user');
      if (!storedId) {
        setCurrentUser(null);
        setIsAuthChecking(false);
        return null;
      }
      const res = await fetch(`/api/auth/me?userId=${encodeURIComponent(storedId)}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const user = await res.json();
          if (user && user.id) {
            setCurrentUser(user);
            setIsAuthChecking(false);
            return user;
          }
        }
      }
    } catch (err) {
      console.warn('Could not load user from API:', err);
    }

    // If no valid session found, clear and remain unauthenticated
    localStorage.removeItem('omnipost_active_user');
    setCurrentUser(null);
    setIsAuthChecking(false);
    return null;
  };

  const handleLogout = () => {
    localStorage.removeItem('omnipost_active_user');
    setCurrentUser(null);
    setActiveWorkspace(null);
    setWorkspaces([]);
    setAccounts([]);
    setPosts([]);
    setLicenseStatus(null);
    setIsAuthModalOpen(false);
    setToast({
      message: 'You have been safely signed out.',
      type: 'success',
    });
  };

  // Fetch License Status
  const fetchLicenseStatus = async (userId?: string) => {
    const uid = userId || currentUser?.id || 'usr_default_master';
    try {
      const res = await fetch(`/api/users/${uid}/license-status`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const status = await res.json();
          setLicenseStatus(status);
        }
      }
    } catch (err) {
      console.warn('Error fetching license status:', err);
    }
  };

  // Check URL for OAuth callback notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successPlatform = params.get('oauth_success');
    const oauthError = params.get('oauth_error');

    if (successPlatform) {
      setToast({
        message: `Successfully authenticated and linked ${successPlatform.toUpperCase()} account via OAuth 2.0 PKCE!`,
        type: 'success',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setToast({
        message: `OAuth authentication failed: ${oauthError}`,
        type: 'error',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch workspaces on mount
  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data: Workspace[] = await res.json();
      setWorkspaces(data);
      if (data.length > 0) {
        if (!activeWorkspace || !data.some((w) => w.id === activeWorkspace.id)) {
          // Prefer first unlocked workspace
          const firstUnlocked = data.find((w) => !w.is_locked) || data[0];
          setActiveWorkspace(firstUnlocked);
        } else {
          const updated = data.find((w) => w.id === activeWorkspace.id);
          if (updated) setActiveWorkspace(updated);
        }
      } else {
        setActiveWorkspace(null);
        setAccounts([]);
        setPosts([]);
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    }
  };

  // Fetch accounts and posts for active workspace
  const fetchWorkspaceData = async (wsId: string) => {
    try {
      const [accRes, postRes] = await Promise.all([
        fetch(`/api/workspaces/${wsId}/accounts`),
        fetch(`/api/workspaces/${wsId}/posts`),
      ]);
      const accData = await accRes.json();
      const postData = await postRes.json();
      setAccounts(accData);
      setPosts(postData);
    } catch (err) {
      console.error('Error loading workspace data:', err);
    }
  };

  const refreshAll = async () => {
    const user = await fetchCurrentUser();
    if (user) {
      await fetchLicenseStatus(user.id);
    }
    await fetchWorkspaces();
    if (activeWorkspace) {
      await fetchWorkspaceData(activeWorkspace.id);
    }
  };

  useEffect(() => {
    (async () => {
      const user = await fetchCurrentUser();
      if (user) {
        await fetchLicenseStatus(user.id);
      }
      await fetchWorkspaces();
    })();
  }, []);

  useEffect(() => {
    if (activeWorkspace) {
      fetchWorkspaceData(activeWorkspace.id);
    }
  }, [activeWorkspace?.id]);

  // Actions
  const handleCreateWorkspace = async (name: string, plan: WorkspacePlan, timezone: string) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, plan, timezone, owner_id: currentUser?.id }),
    });
    const newWs = await res.json();
    if (!res.ok) throw new Error(newWs.error || 'Failed to create workspace');
    await fetchWorkspaces();
    if (currentUser) await fetchLicenseStatus(currentUser.id);
    setActiveWorkspace(newWs);
    setToast({ message: `Workspace "${newWs.name}" created successfully!`, type: 'success' });
  };

  const handleUpgradePlan = async (plan: 'pro') => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const updated = await res.json();
      setActiveWorkspace(updated);
      await fetchWorkspaces();
      setToast({
        message: `Workspace upgraded to ${plan.toUpperCase()}! Quotas expanded.`,
        type: 'success',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!activeWorkspace) return;
    await fetch(`/api/workspaces/${activeWorkspace.id}/accounts/${accountId}`, { method: 'DELETE' });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
    setToast({ message: 'Channel disconnected.', type: 'success' });
  };

  const handleRefreshToken = async (accountId: string) => {
    if (!activeWorkspace) return;
    const res = await fetch(`/api/workspaces/${activeWorkspace.id}/accounts/${accountId}/refresh`, {
      method: 'POST',
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Refresh failed');
    }
    await fetchWorkspaceData(activeWorkspace.id);
  };

  // Post Actions
  const handlePublishNow = async (postId: string) => {
    if (!activeWorkspace) return;
    if (activeWorkspace.is_locked) {
      setToast({
        message: 'This workspace is locked. Re-allocate or renew your license to publish.',
        type: 'error',
      });
      return;
    }
    const res = await fetch(`/api/workspaces/${activeWorkspace.id}/posts/${postId}/publish-now`, {
      method: 'POST',
    });
    const updated = await res.json();
    setToast({
      message:
        updated.status === 'published'
          ? 'Post successfully published!'
          : `Dispatch failed: ${updated.error_message}`,
      type: updated.status === 'published' ? 'success' : 'error',
    });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
  };

  const handleRetry = async (postId: string) => {
    if (!activeWorkspace) return;
    if (activeWorkspace.is_locked) {
      setToast({ message: 'Cannot retry post in locked workspace.', type: 'error' });
      return;
    }
    const res = await fetch(`/api/workspaces/${activeWorkspace.id}/posts/${postId}/retry`, {
      method: 'POST',
    });
    const updated = await res.json();
    setToast({
      message:
        updated.status === 'published' ? 'Post retry succeeded!' : `Retry failed: ${updated.error_message}`,
      type: updated.status === 'published' ? 'success' : 'error',
    });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
  };

  const handleReschedule = async (postId: string, newDate: string) => {
    if (!activeWorkspace) return;
    await fetch(`/api/workspaces/${activeWorkspace.id}/posts/${postId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: newDate }),
    });
    setToast({ message: 'Post rescheduled in queue.', type: 'success' });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
  };

  const handleDuplicate = async (postId: string) => {
    if (!activeWorkspace) return;
    const res = await fetch(`/api/workspaces/${activeWorkspace.id}/posts/${postId}/duplicate`, {
      method: 'POST',
    });
    await res.json();
    setToast({ message: 'Post duplicated into drafts.', type: 'success' });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
  };

  const handleDelete = async (postId: string) => {
    if (!activeWorkspace) return;
    await fetch(`/api/workspaces/${activeWorkspace.id}/posts/${postId}`, { method: 'DELETE' });
    setToast({ message: 'Post removed from queue.', type: 'success' });
    await fetchWorkspaceData(activeWorkspace.id);
    await fetchWorkspaces();
  };

  const handleQuickScheduleForDate = (dateStr: string) => {
    setComposerInitialDate(dateStr);
    setCurrentView('composer');
  };

  const handleLoginSuccess = async (user: User) => {
    localStorage.setItem('omnipost_active_user', user.id);
    setCurrentUser(user);
    await fetchLicenseStatus(user.id);
    await fetchWorkspaces();
    setToast({ message: `Logged in as ${user.name} (${user.role.toUpperCase()})`, type: 'success' });
    if (user.role === 'admin') {
      setCurrentView('admin-panel');
    } else {
      if (currentView === 'admin-panel') setCurrentView('calendar');
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="h-10 w-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
          <Share2 className="w-5 h-5" />
        </div>
        <div className="text-xs font-medium text-zinc-400">Verifying session...</div>
      </div>
    );
  }

  // Strict Authentication Wall: require login/signup before viewing any app content
  if (!currentUser) {
    return (
      <>
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-medium animate-in slide-in-from-top-4 duration-200 bg-zinc-900 border-zinc-700 text-zinc-100">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-zinc-400 hover:text-zinc-100 ml-2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl text-xs font-medium animate-in slide-in-from-top-4 duration-200 bg-zinc-900 border-zinc-700 text-zinc-100">
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-zinc-400 hover:text-zinc-100 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Collapsible Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
        onOpenNewWorkspaceModal={() => setIsNewWsModalOpen(true)}
        onUpgradePlan={handleUpgradePlan}
        currentUser={currentUser}
        licenseStatus={licenseStatus}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenLicenseModal={() => {
          setForceWsSelection(false);
          setIsLicenseModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
        {/* Top Floating Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-400">
              Workspace:{' '}
              <strong className="text-zinc-200">{activeWorkspace?.name || 'None'}</strong>
            </div>
            {activeWorkspace?.is_locked && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Lock className="h-3 w-3" />
                Locked (Quota Exceeded)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Badge / Direct Shortcut */}
            {isAdmin ? (
              <button
                onClick={() => setCurrentView('admin-panel')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  currentView === 'admin-panel'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-amber-400 hover:border-amber-500/30'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Panel</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setForceWsSelection(false);
                  setIsLicenseModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all"
              >
                <Key className="h-3.5 w-3.5 text-blue-400" />
                <span>
                  License:{' '}
                  <span className="text-blue-400">
                    {licenseStatus?.active_workspaces_count || 0}/
                    {licenseStatus?.allowed_workspaces || 0}
                  </span>
                </span>
              </button>
            )}

            {/* User Profile Switcher Button */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-all"
            >
              <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
              <span>{currentUser.name}</span>
            </button>

            {/* Direct Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-red-900/60 hover:bg-red-950/20 text-zinc-400 hover:text-red-300 transition-all"
              title="Sign Out of OmniPost"
            >
              <LogOut className="h-3.5 w-3.5 text-red-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* LOCKED WORKSPACE NOTIFICATION BANNER */}
        {activeWorkspace?.is_locked && currentView !== 'admin-panel' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-300">
                  This Workspace is Currently Locked
                </h3>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Your current license allows up to{' '}
                  <strong>{licenseStatus?.allowed_workspaces || 1} active workspace(s)</strong>.
                  Publishing and channels are paused on locked workspaces to protect your quotas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setForceWsSelection(true);
                  setIsLicenseModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-colors"
              >
                Allocate Active Workspaces
              </button>
              <button
                onClick={() => {
                  setForceWsSelection(false);
                  setIsLicenseModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-amber-500/30 hover:bg-zinc-800 text-amber-300 text-xs font-semibold transition-colors"
              >
                Renew License Key
              </button>
            </div>
          </div>
        )}

        {/* ADMIN PANEL VIEW */}
        {currentView === 'admin-panel' && isAdmin && (
          <AdminPanel
            currentUser={currentUser}
            onUpdateCurrentUser={(updated) => setCurrentUser(updated)}
            onRefreshWorkspaces={refreshAll}
            workspaces={workspaces}
          />
        )}

        {/* NO ACTIVE WORKSPACE ONBOARDING / EMPTY STATE */}
        {!activeWorkspace && currentView !== 'admin-panel' && (
          <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Welcome to OmniPost</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-lg mx-auto">
                {isAdmin
                  ? 'You are logged in as Admin. Head over to the Admin Panel to generate license keys, or create your first workspace below to start scheduling.'
                  : 'Get started by creating your workspace. You will be able to connect multiple social channels (Twitter/X, Facebook, Instagram, LinkedIn, YouTube) and broadcast content seamlessly.'}
              </p>
            </div>

            {/* If user needs a license or has an available license */}
            {!isAdmin && !licenseStatus?.has_license && (
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 text-left max-w-md mx-auto space-y-3">
                <div className="flex items-start gap-2.5">
                  <Key className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-blue-300">Starter Key Ready to Redeem</div>
                    <p className="text-[11px] text-blue-200/70 mt-0.5">
                      An initial key was created by admin. Click below to redeem it or enter your key:
                    </p>
                    <code className="inline-block mt-2 px-2.5 py-1 rounded bg-zinc-950 border border-blue-500/30 font-mono text-xs text-blue-400 select-all font-semibold">
                      OMNI-KEY-1001-ALPHA
                    </code>
                  </div>
                </div>
                <button
                  onClick={() => setIsLicenseModalOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Key className="w-3.5 h-3.5" />
                  Redeem License Key
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsNewWsModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Workspace
              </button>

              {isAdmin && (
                <button
                  onClick={() => setCurrentView('admin-panel')}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition-colors border border-zinc-700 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Open Admin Panel & License Keys
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPOSER VIEW */}
        {currentView === 'composer' && activeWorkspace && (
          <PostComposer
            workspace={activeWorkspace}
            accounts={accounts}
            initialDate={composerInitialDate}
            onPostCreated={async () => {
              await fetchWorkspaceData(activeWorkspace.id);
              await fetchWorkspaces();
            }}
            onNavigateToQueue={() => setCurrentView('calendar')}
            onUpgradePlan={() => handleUpgradePlan('pro')}
          />
        )}

        {/* CALENDAR VIEW */}
        {currentView === 'calendar' && activeWorkspace && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 rounded-xl border border-zinc-800 bg-zinc-900">
                <button
                  onClick={() => setCurrentView('calendar')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-100 shadow-sm"
                >
                  Month Calendar
                </button>
                <button
                  onClick={() => setCurrentView('queue')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Queue List View ({posts.length})
                </button>
              </div>
            </div>

            <CalendarView
              workspace={activeWorkspace}
              posts={posts}
              onSelectPost={(p) => setPreviewPost(p)}
              onQuickScheduleForDate={handleQuickScheduleForDate}
              onOpenComposer={() => {
                setComposerInitialDate(undefined);
                setCurrentView('composer');
              }}
            />
          </div>
        )}

        {/* QUEUE LIST VIEW */}
        {currentView === 'queue' && activeWorkspace && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 rounded-xl border border-zinc-800 bg-zinc-900">
                <button
                  onClick={() => setCurrentView('calendar')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Month Calendar
                </button>
                <button
                  onClick={() => setCurrentView('queue')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-100 shadow-sm"
                >
                  Queue List View ({posts.length})
                </button>
              </div>
            </div>

            <QueueListView
              workspace={activeWorkspace}
              posts={posts}
              onSelectPost={(p) => setPreviewPost(p)}
              onPublishNow={handlePublishNow}
              onRetry={handleRetry}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onOpenComposer={() => {
                setComposerInitialDate(undefined);
                setCurrentView('composer');
              }}
            />
          </div>
        )}

        {/* CHANNELS VIEW */}
        {currentView === 'channels' && activeWorkspace && (
          <AccountsView
            workspace={activeWorkspace}
            accounts={accounts}
            onDisconnect={handleDisconnect}
            onRefreshToken={handleRefreshToken}
            onUpgradePlan={() => handleUpgradePlan('pro')}
          />
        )}

        {/* ANALYTICS VIEW */}
        {currentView === 'analytics' && activeWorkspace && (
          <AnalyticsView workspace={activeWorkspace} />
        )}

        {/* LOGS VIEW */}
        {currentView === 'logs' && activeWorkspace && (
          <DispatchLogsView
            workspace={activeWorkspace}
            onRefreshData={async () => {
              await fetchWorkspaceData(activeWorkspace.id);
              await fetchWorkspaces();
            }}
          />
        )}
      </main>

      {/* Post Preview Modal */}
      <PostPreviewModal
        post={previewPost}
        onClose={() => setPreviewPost(null)}
        onPublishNow={handlePublishNow}
        onRetry={handleRetry}
        onReschedule={handleReschedule}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Workspace Creation Modal */}
      <WorkspaceModal
        isOpen={isNewWsModalOpen}
        onClose={() => setIsNewWsModalOpen(false)}
        onCreate={handleCreateWorkspace}
        licenseStatus={licenseStatus}
        onOpenLicenseModal={() => {
          setForceWsSelection(false);
          setIsLicenseModalOpen(true);
        }}
      />

      {/* License Key & Workspace Selection Modal */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => {
          setIsLicenseModalOpen(false);
          setForceWsSelection(false);
        }}
        currentUser={currentUser}
        workspaces={workspaces}
        licenseStatus={licenseStatus}
        onRefreshData={refreshAll}
        forceWorkspaceSelection={forceWsSelection}
      />

      {/* Auth & User Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    </div>
  );
}