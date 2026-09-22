import React, { useState } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Send,
  Trash2,
  Copy,
  Calendar,
  Eye,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  MousePointerClick,
} from 'lucide-react';
import { Post, PLATFORM_CONFIGS, SocialPlatform } from '../types';

interface PostPreviewModalProps {
  post: Post | null;
  onClose: () => void;
  onPublishNow: (postId: string) => Promise<void>;
  onRetry: (postId: string) => Promise<void>;
  onReschedule: (postId: string, newDate: string) => Promise<void>;
  onDuplicate: (postId: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
}

export const PostPreviewModal: React.FC<PostPreviewModalProps> = ({
  post,
  onClose,
  onPublishNow,
  onRetry,
  onReschedule,
  onDuplicate,
  onDelete,
}) => {
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);
  const [isActing, setIsActing] = useState(false);

  if (!post) return null;

  const isFailed = post.status === 'failed';
  const isScheduled = post.status === 'scheduled';
  const isPublished = post.status === 'published';

  const handleAction = async (fn: () => Promise<void>) => {
    try {
      setIsActing(true);
      await fn();
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleDate) return;
    await handleAction(() => onReschedule(post.id, new Date(rescheduleDate).toISOString()));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div
        id="post-preview-modal"
        className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {post.target_platforms.map((plat) => (
                <span
                  key={plat}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                  style={{ backgroundColor: PLATFORM_CONFIGS[plat]?.color || '#3b82f6' }}
                >
                  {plat === 'twitter' ? 'X' : plat}
                </span>
              ))}
            </div>

            {isScheduled && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3" />
                <span>Queued</span>
              </span>
            )}
            {isPublished && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                <span>Published</span>
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" />
                <span>Failed</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Failure Diagnostics Banner */}
        {isFailed && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 space-y-1.5">
            <div className="font-semibold text-red-200 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{post.error_message || 'Dispatch attempt failed'}</span>
            </div>
            {post.error_details?.actionable_remedy && (
              <p className="text-[11px] text-red-300 pl-5">
                Action: {post.error_details.actionable_remedy}
              </p>
            )}
          </div>
        )}

        {/* Post Content */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>

          {post.media_urls.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-72">
              <img src={post.media_urls[0]} alt="Media" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Timing info */}
        <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-3">
          <div>
            {post.scheduled_at && (
              <span>
                Scheduled Time: <strong className="text-zinc-200">{new Date(post.scheduled_at).toLocaleString()}</strong>
              </span>
            )}
            {post.published_at && (
              <span>
                Published: <strong className="text-zinc-200">{new Date(post.published_at).toLocaleString()}</strong>
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">ID: {post.id}</span>
        </div>

        {/* Analytics if published */}
        {isPublished && post.analytics && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span>Post Performance Analytics</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-zinc-900 p-2">
                <span className="text-[10px] text-zinc-400 block uppercase">Reach</span>
                <strong className="text-sm text-zinc-100">{post.analytics.reach.toLocaleString()}</strong>
              </div>
              <div className="rounded-lg bg-zinc-900 p-2">
                <span className="text-[10px] text-zinc-400 block uppercase">Engagements</span>
                <strong className="text-sm text-zinc-100">{post.analytics.engagements.toLocaleString()}</strong>
              </div>
              <div className="rounded-lg bg-zinc-900 p-2">
                <span className="text-[10px] text-zinc-400 block uppercase">Likes</span>
                <strong className="text-sm text-zinc-100">{post.analytics.likes.toLocaleString()}</strong>
              </div>
              <div className="rounded-lg bg-zinc-900 p-2">
                <span className="text-[10px] text-zinc-400 block uppercase">Clicks</span>
                <strong className="text-sm text-zinc-100">{post.analytics.clicks.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Input field */}
        {showRescheduleInput && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-2">
            <label className="block text-xs font-medium text-blue-300">
              Pick New Scheduled Date & Time
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
              />
              <button
                onClick={submitReschedule}
                disabled={!rescheduleDate || isActing}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction(() => onDelete(post.id))}
              disabled={isActing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => handleAction(() => onDuplicate(post.id))}
              disabled={isActing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isScheduled && (
              <button
                onClick={() => setShowRescheduleInput(!showRescheduleInput)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Reschedule</span>
              </button>
            )}

            {isFailed && (
              <button
                onClick={() => handleAction(() => onRetry(post.id))}
                disabled={isActing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-500 transition-colors"
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Retry Dispatch</span>
              </button>
            )}

            {isScheduled && (
              <button
                onClick={() => handleAction(() => onPublishNow(post.id))}
                disabled={isActing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Publish Immediately</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
