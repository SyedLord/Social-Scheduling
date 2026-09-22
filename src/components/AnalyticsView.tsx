import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  MousePointerClick,
  Heart,
  Share2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { Workspace, SocialPlatform, PLATFORM_CONFIGS } from '../types';

interface AnalyticsViewProps {
  workspace: Workspace;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ workspace }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${workspace.id}/analytics`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [workspace.id]);

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-xs text-zinc-500">
        Aggregating multi-platform metrics...
      </div>
    );
  }

  const { totals, platformBreakdown, topPosts } = data;

  const statCards = [
    {
      title: 'Total Audience Reach',
      value: totals.reach.toLocaleString(),
      change: '+14.2% vs last mo',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      title: 'Total Engagements',
      value: totals.engagements.toLocaleString(),
      change: '+22.8% vs last mo',
      icon: Heart,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
    },
    {
      title: 'Gross Impressions',
      value: totals.impressions.toLocaleString(),
      change: '+18.5%',
      icon: Eye,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      title: 'Avg. Engagement Rate',
      value: totals.avgEngagementRate,
      change: 'Industry Top 10%',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <span>Multi-Channel Social Performance</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Unified engagement metrics and distribution insights for {workspace.name}.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{c.title}</span>
                <div className={`p-2 rounded-xl ${c.bg} ${c.color} border ${c.border}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-zinc-100">{c.value}</div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>{c.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform Breakdown & Channel Reach */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Platform Distribution Bars */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Distribution by Network</h3>
            <span className="text-xs text-zinc-400">Total Published: {totals.publishedCount}</span>
          </div>

          <div className="space-y-4 pt-1">
            {(['twitter', 'linkedin', 'instagram', 'facebook', 'youtube'] as SocialPlatform[]).map((plat) => {
              const cfg = PLATFORM_CONFIGS[plat];
              const pData = platformBreakdown[plat] || { posts: 0, reach: 0, engagements: 0 };
              const percent = totals.reach > 0 ? Math.min(100, Math.round((pData.reach / totals.reach) * 100)) : 20;

              return (
                <div key={plat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="font-medium text-zinc-200">{cfg.name}</span>
                    </div>
                    <span className="font-mono text-zinc-400">{pData.reach.toLocaleString()} reach ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interaction Highlights */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">Engagement Breakdown</h3>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-1">
              <span className="text-[11px] text-zinc-400">Total Likes & Reactions</span>
              <div className="text-lg font-bold text-zinc-100">{totals.likes.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-1">
              <span className="text-[11px] text-zinc-400">Shares & Retweets</span>
              <div className="text-lg font-bold text-zinc-100">{totals.shares.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-1">
              <span className="text-[11px] text-zinc-400">Comments & Replies</span>
              <div className="text-lg font-bold text-zinc-100">{totals.comments.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-1">
              <span className="text-[11px] text-zinc-400">Link Clicks & CTR</span>
              <div className="text-lg font-bold text-zinc-100">{totals.clicks.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">Top Performing Posts</h3>

        <div className="space-y-3">
          {topPosts.map((p: any, idx: number) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-xs font-bold text-zinc-500 mt-0.5">#{idx + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {p.target_platforms.map((plat: SocialPlatform) => (
                      <span
                        key={plat}
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold text-white uppercase"
                        style={{ backgroundColor: PLATFORM_CONFIGS[plat]?.color || '#3b82f6' }}
                      >
                        {plat === 'twitter' ? 'X' : plat}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-200 truncate max-w-lg">{p.content}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs shrink-0 text-zinc-400 border-t md:border-t-0 border-zinc-800 pt-2 md:pt-0">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Reach</span>
                  <strong className="text-zinc-200">{p.analytics?.reach?.toLocaleString() || 0}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Engagements</span>
                  <strong className="text-zinc-200">{p.analytics?.engagements?.toLocaleString() || 0}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Likes</span>
                  <strong className="text-zinc-200">{p.analytics?.likes?.toLocaleString() || 0}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
