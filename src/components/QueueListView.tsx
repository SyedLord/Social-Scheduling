import React, { useState } from 'react';
import {
  ListFilter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Send,
  Trash2,
  Copy,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Post, SocialPlatform, PLATFORM_CONFIGS, Workspace } from '../types';

interface QueueListViewProps {
  workspace: Workspace;
  posts: Post[];
  onSelectPost: (post: Post) => void;
  onPublishNow: (postId: string) => Promise<void>;
  onRetry: (postId: string) => Promise<void>;
  onDuplicate: (postId: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  onOpenComposer: () => void;
}

export const QueueListView: React.FC<QueueListViewProps> = ({
  workspace,
  posts,
  onSelectPost,
  onPublishNow,
  onRetry,
  onDuplicate,
  onDelete,
  onOpenComposer,
}) => {
  const [tab, setTab] = useState<'all' | 'scheduled' | 'published' | 'failed' | 'draft'>('all');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filteredPosts = posts.filter((p) => {
    if (tab === 'all') return true;
    return p.status === tab;
  });

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    try {
      setLoadingAction(action);
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <ListFilter className="h-5 w-5 text-blue-400" />
            <span>Scheduled Queue & History</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review upcoming queued dispatches, published releases, and errors requiring attention.
          </p>
        </div>

        <button
          onClick={onOpenComposer}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/20 self-start sm:self-auto"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>New Post</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-3">
        {[
          { id: 'all', label: 'All Posts', count: posts.length },
          { id: 'scheduled', label: 'Queue (Scheduled)', count: posts.filter((p) => p.status === 'scheduled').length },
          { id: 'published', label: 'Published', count: posts.filter((p) => p.status === 'published').length },
          { id: 'failed', label: 'Failed Attempts', count: posts.filter((p) => p.status === 'failed').length },
          { id: 'draft', label: 'Drafts', count: posts.filter((p) => p.status === 'draft').length },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as any)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              tab === item.id
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                item.id === 'failed' && item.count > 0
                  ? 'bg-red-500/20 text-red-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center bg-zinc-950/40">
          <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-3">
            <Clock className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 mb-1">No posts found in this view</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
            {tab === 'scheduled'
              ? 'Your queue is empty. Schedule new content to keep audience engagement flowing.'
              : 'Create posts across Instagram, Twitter, LinkedIn, Facebook, and YouTube.'}
          </p>
          <button
            onClick={onOpenComposer}
            className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Schedule Your First Post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const isFailed = post.status === 'failed';
            const isScheduled = post.status === 'scheduled';
            const isPublished = post.status === 'published';
            const isPublishing = post.status === 'publishing';

            return (
              <div
                key={post.id}
                className="group rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition-all hover:border-zinc-700/80 hover:bg-zinc-900 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left content snippet */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0 cursor-pointer" onClick={() => onSelectPost(post)}>
                    {post.media_urls.length > 0 ? (
                      <img
                        src={post.media_urls[0]}
                        alt="Media"
                        className="h-16 w-16 rounded-xl object-cover border border-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-zinc-800/60 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    )}

                    <div className="space-y-1.5 min-w-0">
                      {/* Platform chips & Status */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {post.target_platforms.map((plat) => {
                            const cfg = PLATFORM_CONFIGS[plat];
                            return (
                              <span
                                key={plat}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-white uppercase"
                                style={{ backgroundColor: cfg?.color || '#3b82f6' }}
                              >
                                {plat === 'twitter' ? 'X' : plat}
                              </span>
                            );
                          })}
                        </div>

                        {/* Status Badge */}
                        {isScheduled && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            <span>Queued</span>
                          </span>
                        )}
                        {isPublishing && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                            <Repeat className="h-3 w-3 animate-spin" />
                            <span>Publishing...</span>
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
                            <span>Failed Dispatch</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed font-normal">
                        {post.content}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-0.5">
                        {post.scheduled_at && (
                          <span>
                            Scheduled: <strong className="text-zinc-300 font-mono">{new Date(post.scheduled_at).toLocaleString()}</strong>
                          </span>
                        )}
                        {post.published_at && (
                          <span>
                            Published: <strong className="text-zinc-300 font-mono">{new Date(post.published_at).toLocaleString()}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isFailed && (
                      <button
                        onClick={() => handleAction(`retry-${post.id}`, () => onRetry(post.id))}
                        disabled={loadingAction === `retry-${post.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-all"
                      >
                        <Repeat className={`h-3 w-3 ${loadingAction === `retry-${post.id}` ? 'animate-spin' : ''}`} />
                        <span>Retry Post</span>
                      </button>
                    )}

                    {isScheduled && (
                      <button
                        onClick={() => handleAction(`pub-${post.id}`, () => onPublishNow(post.id))}
                        disabled={loadingAction === `pub-${post.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-all"
                      >
                        <Send className="h-3 w-3" />
                        <span>Publish Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(`dup-${post.id}`, () => onDuplicate(post.id))}
                      className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                      title="Duplicate Post"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleAction(`del-${post.id}`, () => onDelete(post.id))}
                      className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Post"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => onSelectPost(post)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                      title="Preview Post"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Error Banner with Actionable Resolution */}
                {isFailed && post.error_message && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-red-200">
                      <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span>{post.error_message}</span>
                    </div>
                    {post.error_details?.actionable_remedy && (
                      <p className="text-[11px] text-red-400 pl-5">
                        💡 Resolution: {post.error_details.actionable_remedy}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
