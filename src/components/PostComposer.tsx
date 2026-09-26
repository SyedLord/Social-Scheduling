import React, { useState } from 'react';
import {
  PenSquare,
  Sparkles,
  Image as ImageIcon,
  Calendar,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Share2,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  ThumbsUp,
  MessageSquare,
  Youtube,
  Info,
} from 'lucide-react';
import {
  SocialPlatform,
  WorkspaceAccount,
  Workspace,
  PLATFORM_CONFIGS,
  Post,
} from '../types';

interface PostComposerProps {
  workspace: Workspace;
  accounts: WorkspaceAccount[];
  initialDate?: string;
  onPostCreated: (post: Post) => void;
  onNavigateToQueue: () => void;
}

const PRESET_MEDIA_LIBRARY = [
  {
    name: 'Tech Office & Product Sprint',
    url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&auto=format&fit=crop&q=80',
    type: 'image' as const,
  },
  {
    name: 'Growth Analytics & Dashboard',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
    type: 'image' as const,
  },
  {
    name: 'Creative Studio Motion',
    url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80',
    type: 'video' as const,
  },
  {
    name: 'Modern Architecture Minimal',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    type: 'image' as const,
  },
];

export const PostComposer: React.FC<PostComposerProps> = ({
  workspace,
  accounts,
  initialDate,
  onPostCreated,
  onNavigateToQueue,
}) => {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['twitter', 'linkedin']);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [customMediaInput, setCustomMediaInput] = useState('');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialPlatform>('twitter');
  const [publishMode, setPublishMode] = useState<'schedule' | 'now' | 'draft'>('schedule');

  // Date and Time
  const defaultDate = initialDate || new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16);
  const [scheduledAt, setScheduledAt] = useState(defaultDate);

  // AI Assistant states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Engaging & Strategic');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const togglePlatform = (plat: SocialPlatform) => {
    setSelectedPlatforms((prev) => {
      const exists = prev.includes(plat);
      if (exists) {
        if (prev.length === 1) return prev; // keep at least 1
        const next = prev.filter((p) => p !== plat);
        if (activePreviewPlatform === plat && next.length > 0) {
          setActivePreviewPlatform(next[0]);
        }
        return next;
      } else {
        return [...prev, plat];
      }
    });
  };

  const selectAllPlatforms = () => {
    setSelectedPlatforms(['twitter', 'linkedin', 'instagram', 'facebook', 'youtube']);
  };

  const handleAddMedia = (url: string) => {
    if (!mediaUrls.includes(url)) {
      setMediaUrls((prev) => [...prev, url]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          platform: activePreviewPlatform,
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (data.caption) {
        setContent(data.caption);
        setShowAiModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (overrideMode?: 'schedule' | 'now' | 'draft') => {
    const mode = overrideMode || publishMode;
    if (!content.trim()) {
      setErrorMessage('Please provide caption content for your post.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setErrorMessage('Select at least one destination platform.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const targetAccountIds = accounts
        .filter((a) => selectedPlatforms.includes(a.platform))
        .map((a) => a.id);

      const res = await fetch(`/api/workspaces/${workspace.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          media_urls: mediaUrls,
          media_type: mediaUrls.length > 1 ? 'carousel' : mediaUrls.length === 1 ? 'image' : 'none',
          target_platforms: selectedPlatforms,
          target_account_ids: targetAccountIds,
          status: mode === 'draft' ? 'draft' : 'scheduled',
          scheduled_at: mode === 'schedule' ? new Date(scheduledAt).toISOString() : undefined,
          publish_immediately: mode === 'now',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule post');
      }

      setSuccessMessage(
        mode === 'now'
          ? 'Post dispatched immediately to selected platforms!'
          : mode === 'schedule'
          ? 'Post added to queue and scheduled successfully!'
          : 'Draft saved successfully.'
      );

      onPostCreated(data);

      // Reset form
      setContent('');
      setMediaUrls([]);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error scheduling post');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check character limits for active preview platform
  const currentConfig = PLATFORM_CONFIGS[activePreviewPlatform];
  const charCount = content.length;
  const isOverLimit = charCount > currentConfig.maxCharacters;

  // Selected accounts display
  const relevantAccounts = accounts.filter((a) => selectedPlatforms.includes(a.platform));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <PenSquare className="h-5 w-5 text-blue-400" />
            <span>Multi-Platform Post Composer</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Craft, preview in real-time, and schedule across Instagram, X, LinkedIn, Facebook, and YouTube.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-violet-600/20 border border-blue-500/30 text-blue-300 hover:text-white hover:border-blue-500 text-xs font-semibold transition-all shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>AI Caption Assistant</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={onNavigateToQueue}
            className="underline font-semibold hover:text-emerald-200 ml-4"
          >
            View in Calendar Queue →
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Composer Layout: Two Columns (Editor on Left, Live Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* Target Platforms Picker */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Destination Platforms
              </label>
              <button
                type="button"
                onClick={selectAllPlatforms}
                className="text-[11px] text-blue-400 hover:underline"
              >
                Select All
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['twitter', 'linkedin', 'instagram', 'facebook', 'youtube'] as SocialPlatform[]).map((plat) => {
                const isSelected = selectedPlatforms.includes(plat);
                const config = PLATFORM_CONFIGS[plat];
                const acc = accounts.find((a) => a.platform === plat);

                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => togglePlatform(plat)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-zinc-600 bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-zinc-500'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span>{config.name}</span>
                    {acc ? (
                      <span className="text-[10px] text-zinc-500 ml-0.5 font-normal">
                        ({acc.account_handle.slice(0, 10)})
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400/80 ml-0.5">• unlinked</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Editor Area */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Post Caption & Hashtags
              </label>
              {/* Character Limit Indicator */}
              <div
                className={`text-xs font-mono font-medium ${
                  isOverLimit
                    ? 'text-red-400 font-bold'
                    : charCount > currentConfig.characterWarningThreshold
                    ? 'text-amber-400'
                    : 'text-zinc-400'
                }`}
              >
                {charCount} / {currentConfig.maxCharacters} chars ({currentConfig.name})
              </div>
            </div>

            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening? Share insights, company news, product launches, or stories..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
            />

            {isOverLimit && (
              <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Length exceeds {currentConfig.name} limit by {charCount - currentConfig.maxCharacters} chars.
                </span>
              </p>
            )}
          </div>

          {/* Media Attachments Section */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-zinc-400" />
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Media Assets ({mediaUrls.length})
                </label>
              </div>
              <span className="text-[11px] text-zinc-500">JPG, PNG, WebP, MP4</span>
            </div>

            {/* Attached Thumbnails */}
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-zinc-700 h-20 w-24">
                    <img src={url} alt="Attached" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(i)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/80 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom URL upload */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste public image or video URL..."
                value={customMediaInput}
                onChange={(e) => setCustomMediaInput(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (customMediaInput.trim()) {
                    handleAddMedia(customMediaInput.trim());
                    setCustomMediaInput('');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Add URL
              </button>
            </div>

            {/* Curated Preset Library */}
            <div>
              <p className="text-[11px] text-zinc-400 mb-1.5 font-medium">Quick Presets Library:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_MEDIA_LIBRARY.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddMedia(item.url)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-all"
                  >
                    <span>+ {item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scheduling Date & Dispatch Options */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span>Scheduling & Timing</span>
              </label>
              <div className="text-[11px] text-zinc-400">
                Timezone: <span className="text-zinc-200 font-medium">{workspace.settings.timezone}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPublishMode('schedule')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  publishMode === 'schedule'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300 ring-1 ring-blue-500'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Schedule Date
              </button>
              <button
                type="button"
                onClick={() => setPublishMode('now')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  publishMode === 'now'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Publish Now
              </button>
              <button
                type="button"
                onClick={() => setPublishMode('draft')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  publishMode === 'draft'
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-200 ring-1 ring-zinc-500'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Save Draft
              </button>
            </div>

            {publishMode === 'schedule' && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16);
                      setScheduledAt(d);
                    }}
                    className="text-zinc-400 hover:text-blue-400"
                  >
                    +2 Hours
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(9, 0, 0, 0);
                      setScheduledAt(tomorrow.toISOString().slice(0, 16));
                    }}
                    className="text-zinc-400 hover:text-blue-400"
                  >
                    Tomorrow 9 AM
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const friday = new Date();
                      friday.setDate(friday.getDate() + ((7 + 5 - friday.getDay()) % 7 || 7));
                      friday.setHours(15, 0, 0, 0);
                      setScheduledAt(friday.toISOString().slice(0, 16));
                    }}
                    className="text-zinc-400 hover:text-blue-400"
                  >
                    Friday 3 PM
                  </button>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                disabled={isSubmitting || isOverLimit}
                onClick={() => handleSubmit()}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold text-white transition-all shadow-lg ${
                  publishMode === 'now'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {isSubmitting
                    ? 'Processing...'
                    : publishMode === 'now'
                    ? 'Dispatch to Selected Platforms Immediately'
                    : publishMode === 'schedule'
                    ? 'Add Post to Dispatch Queue'
                    : 'Save as Draft'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Multi-Platform Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Eye className="h-4 w-4 text-zinc-400" />
              <span>Live Social Previews</span>
            </label>
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
              {selectedPlatforms.map((plat) => (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setActivePreviewPlatform(plat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    activePreviewPlatform === plat
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {plat === 'twitter' ? 'X' : plat.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* PREVIEW CONTAINER */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-4 shadow-xl min-h-[420px] flex flex-col justify-between">
            <div>
              {/* TWITTER PREVIEW */}
              {activePreviewPlatform === 'twitter' && (
                <div className="border border-zinc-800 rounded-xl p-4 bg-black text-zinc-100 font-sans space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                        {relevantAccounts.find((a) => a.platform === 'twitter')?.account_avatar ? (
                          <img
                            src={relevantAccounts.find((a) => a.platform === 'twitter')?.account_avatar}
                            className="h-full w-full object-cover"
                            alt="avatar"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-zinc-300">
                            X
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm text-zinc-100">
                            {relevantAccounts.find((a) => a.platform === 'twitter')?.account_name || 'Brand Studio'}
                          </span>
                          <span className="text-blue-400 text-xs">✓</span>
                        </div>
                        <span className="text-xs text-zinc-400">
                          {relevantAccounts.find((a) => a.platform === 'twitter')?.account_handle || '@brandstudio'}
                        </span>
                      </div>
                    </div>
                    <span className="text-zinc-400 font-bold text-sm">𝕏</span>
                  </div>

                  <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {content || 'Your post caption will be formatted here live...'}
                  </p>

                  {mediaUrls.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-56">
                      <img src={mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-zinc-400 pt-2 border-t border-zinc-900 text-xs">
                    <div className="flex items-center gap-1 hover:text-blue-400">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>24</span>
                    </div>
                    <div className="flex items-center gap-1 hover:text-green-400">
                      <Repeat2 className="h-3.5 w-3.5" />
                      <span>18</span>
                    </div>
                    <div className="flex items-center gap-1 hover:text-pink-400">
                      <Heart className="h-3.5 w-3.5" />
                      <span>96</span>
                    </div>
                    <div className="flex items-center gap-1 hover:text-blue-400">
                      <Bookmark className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* INSTAGRAM PREVIEW */}
              {activePreviewPlatform === 'instagram' && (
                <div className="border border-zinc-800 rounded-xl bg-zinc-950 text-zinc-100 font-sans space-y-2.5 overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-zinc-900">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5">
                        <div className="h-full w-full rounded-full bg-zinc-900 overflow-hidden">
                          {relevantAccounts.find((a) => a.platform === 'instagram')?.account_avatar ? (
                            <img
                              src={relevantAccounts.find((a) => a.platform === 'instagram')?.account_avatar}
                              className="h-full w-full object-cover"
                              alt="avatar"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs font-bold">
                              IG
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-xs text-zinc-200">
                        {relevantAccounts.find((a) => a.platform === 'instagram')?.account_handle || '@instagram_creator'}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-xs font-bold">•••</span>
                  </div>

                  <div className="aspect-square w-full bg-zinc-900 flex items-center justify-center overflow-hidden border-y border-zinc-900">
                    {mediaUrls.length > 0 ? (
                      <img src={mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6">
                        <ImageIcon className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                        <span className="text-xs text-zinc-500">
                          Instagram requires at least 1 image or video asset.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-3">
                        <Heart className="h-4 w-4" />
                        <MessageCircle className="h-4 w-4" />
                        <Send className="h-4 w-4" />
                      </div>
                      <Bookmark className="h-4 w-4" />
                    </div>

                    <div className="text-xs">
                      <span className="font-bold text-zinc-200 mr-2">
                        {relevantAccounts.find((a) => a.platform === 'instagram')?.account_handle || '@creator'}
                      </span>
                      <span className="text-zinc-300 whitespace-pre-wrap">
                        {content || 'Instagram caption formatted here...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LINKEDIN PREVIEW */}
              {activePreviewPlatform === 'linkedin' && (
                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900 text-zinc-100 font-sans space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-500/30 overflow-hidden">
                      {relevantAccounts.find((a) => a.platform === 'linkedin')?.account_avatar ? (
                        <img
                          src={relevantAccounts.find((a) => a.platform === 'linkedin')?.account_avatar}
                          className="h-full w-full object-cover"
                          alt="avatar"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-bold text-blue-400">
                          in
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-100">
                        {relevantAccounts.find((a) => a.platform === 'linkedin')?.account_name || 'Acme Enterprises Inc.'}
                      </div>
                      <div className="text-[10px] text-zinc-400">Company • 18,400 followers • 1h • 🌐</div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed line-clamp-6">
                    {content || 'LinkedIn update text preview...'}
                  </p>

                  {mediaUrls.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-zinc-800 max-h-52">
                      <img src={mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-zinc-400 pt-2 border-t border-zinc-800 text-[11px]">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>Like</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Comment</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="h-3.5 w-3.5" />
                      <span>Repost</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Send className="h-3.5 w-3.5" />
                      <span>Send</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FACEBOOK PREVIEW */}
              {activePreviewPlatform === 'facebook' && (
                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900 text-zinc-100 font-sans space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      f
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-100">
                        {relevantAccounts.find((a) => a.platform === 'facebook')?.account_name || 'Official Brand Page'}
                      </div>
                      <div className="text-[10px] text-zinc-400">Just now • 🌐 Public</div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {content || 'Facebook page post preview...'}
                  </p>

                  {mediaUrls.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-zinc-800 max-h-56">
                      <img src={mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* YOUTUBE PREVIEW */}
              {activePreviewPlatform === 'youtube' && (
                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900 text-zinc-100 font-sans space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-white">
                        <Youtube className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-zinc-100">
                          {relevantAccounts.find((a) => a.platform === 'youtube')?.account_name || 'Creator Studio'}
                        </div>
                        <div className="text-[10px] text-zinc-400">Community Post / Video Update</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {content || 'YouTube community post text...'}
                  </p>

                  {mediaUrls.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-zinc-800 max-h-52">
                      <img src={mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview footer note */}
            <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>Pixel-accurate live render</span>
              </span>
              <span className="text-[10px] uppercase font-mono text-zinc-400">
                {currentConfig.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI CAPTION ASSISTANT MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">AI Caption & Hook Generator</h3>
                  <p className="text-xs text-zinc-400">Generate high-converting social copy</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Topic / Core Message
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Announcing our new v2 platform, sharing 3 lessons on organic audience building, or behind the scenes look..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Tone & Archetype
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Engaging & Strategic">Engaging & Strategic (High CTR)</option>
                  <option value="Authoritative & Professional">Authoritative & Thought Leadership</option>
                  <option value="Viral & Punchy">Viral & Punchy (Short Hooks)</option>
                  <option value="Casual & Authentic">Casual & Community Focused</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAiLoading || !aiPrompt.trim()}
                  onClick={handleAiGenerate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-md shadow-blue-600/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isAiLoading ? 'Writing Copy...' : 'Generate Caption'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};