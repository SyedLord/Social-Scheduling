import React, { useState } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  UserPlus,
  LogIn,
  X,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [mode, setMode] = useState<'switch' | 'login' | 'register'>('switch');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickSwitch = async (targetEmail: string, pass: string) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: pass }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to switch user');
        return;
      }
      onLoginSuccess(data.user);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error logging in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Invalid credentials');
        return;
      }
      onLoginSuccess(data.user);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error signing in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Registration failed');
        return;
      }
      onLoginSuccess(data.user);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error creating account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                {mode === 'switch' ? 'Account Profile & Switcher' : mode === 'login' ? 'Sign In to OmniPost' : 'Create New Account'}
              </h2>
              <p className="text-[11px] text-zinc-400">Multi-tenant role & workspace authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'switch' && (
            <div className="space-y-4">
              <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                Current Logged In User
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-200 font-bold border border-zinc-700">
                    {currentUser?.name?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                      <span>{currentUser?.name}</span>
                      {currentUser?.role === 'admin' && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">{currentUser?.email}</div>
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>

              {/* Fast Presets Switcher */}
              <div className="space-y-2 pt-2">
                <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                  Switch Profiles Instantly
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || currentUser?.email === 'admin@omnipost.io'}
                  onClick={() => handleQuickSwitch('admin@omnipost.io', 'admin123')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    currentUser?.email === 'admin@omnipost.io'
                      ? 'border-amber-500/40 bg-amber-500/5 cursor-default'
                      : 'border-zinc-800 bg-zinc-950 hover:border-amber-500/40 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span>System Admin</span>
                        <span className="text-[10px] text-amber-400 font-medium">(License & Admin Panel)</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">admin@omnipost.io</div>
                    </div>
                  </div>
                  {currentUser?.email === 'admin@omnipost.io' ? (
                    <span className="text-[10px] text-amber-400 font-medium">Current</span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 hover:text-zinc-200">Switch →</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || currentUser?.email === 'user@omnipost.io'}
                  onClick={() => handleQuickSwitch('user@omnipost.io', 'user123')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    currentUser?.email === 'user@omnipost.io'
                      ? 'border-blue-500/40 bg-blue-500/5 cursor-default'
                      : 'border-zinc-800 bg-zinc-950 hover:border-blue-500/40 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span>Standard User</span>
                        <span className="text-[10px] text-blue-400 font-medium">(Social Workspaces)</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">user@omnipost.io</div>
                    </div>
                  </div>
                  {currentUser?.email === 'user@omnipost.io' ? (
                    <span className="text-[10px] text-blue-400 font-medium">Current</span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 hover:text-zinc-200">Switch →</span>
                  )}
                </button>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign in with other email
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Register new account
                </button>
              </div>

              {onLogout && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-red-900/40 bg-red-950/20 hover:bg-red-900/30 text-red-300 hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of OmniPost</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode('switch')}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ← Back to Switcher
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Create account
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Sarah Khan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="sarah@agency.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create secure password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isSubmitting ? 'Creating...' : 'Register Account'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode('switch')}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ← Back to Switcher
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
