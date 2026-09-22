import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { Post, SocialPlatform, PLATFORM_CONFIGS, Workspace } from '../types';

interface CalendarViewProps {
  workspace: Workspace;
  posts: Post[];
  onSelectPost: (post: Post) => void;
  onQuickScheduleForDate: (dateStr: string) => void;
  onOpenComposer: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  workspace,
  posts,
  onSelectPost,
  onQuickScheduleForDate,
  onOpenComposer,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter !== 'all' && !p.target_platforms.includes(platformFilter as SocialPlatform)) {
        return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim() && !p.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [posts, platformFilter, statusFilter, searchQuery]);

  // Generate days in month grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Days array
  const calendarCells = useMemo(() => {
    const cells = [];
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        dateString: new Date(year, month - 1, prevMonthDays - i).toISOString().split('T')[0],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthPadded = String(month + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      cells.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateString: `${year}-${monthPadded}-${dayPadded}`,
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
    for (let n = 1; n <= remaining; n++) {
      const nextMonthNumber = month + 2 > 12 ? 1 : month + 2;
      const nextYearNumber = month + 2 > 12 ? year + 1 : year;
      const mPad = String(nextMonthNumber).padStart(2, '0');
      const dPad = String(n).padStart(2, '0');
      cells.push({
        dayNumber: n,
        isCurrentMonth: false,
        dateString: `${nextYearNumber}-${mPad}-${dPad}`,
      });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <CalendarIcon className="h-5 w-5 text-blue-400" />
            <span>Visual Scheduling Calendar</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Interactive multi-channel queue grid for {workspace.name}. Click any date cell to schedule.
          </p>
        </div>

        {/* Month Navigation & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-zinc-200 min-w-[140px] text-center">
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Today
          </button>

          <button
            onClick={onOpenComposer}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/60">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Platform Filter */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <span>Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Channels</option>
              <option value="twitter">X (Twitter)</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All States</option>
              <option value="scheduled">Scheduled Queue</option>
              <option value="published">Published</option>
              <option value="failed">Failed / Needs Attention</option>
              <option value="draft">Drafts</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search scheduled posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Week Header */}
      <div className="grid grid-cols-7 gap-px rounded-t-2xl bg-zinc-800 overflow-hidden border border-zinc-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="bg-zinc-900/90 py-2 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-b-2xl overflow-hidden border border-t-0 border-zinc-800 shadow-xl">
        {calendarCells.map((cell, idx) => {
          const isToday = cell.dateString === todayStr;
          // Find posts for this day
          const dayPosts = filteredPosts.filter((p) => {
            const postDate = p.scheduled_at || p.published_at || p.created_at;
            return postDate && postDate.startsWith(cell.dateString);
          });

          return (
            <div
              key={idx}
              className={`min-h-[115px] p-2 flex flex-col justify-between transition-colors relative group ${
                cell.isCurrentMonth
                  ? isToday
                    ? 'bg-blue-950/20'
                    : 'bg-zinc-950 hover:bg-zinc-900/70'
                  : 'bg-zinc-950/40 text-zinc-600'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-semibold rounded-md h-6 w-6 flex items-center justify-center ${
                    isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : cell.isCurrentMonth
                      ? 'text-zinc-300'
                      : 'text-zinc-600'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Quick Add icon on hover */}
                {cell.isCurrentMonth && (
                  <button
                    onClick={() => onQuickScheduleForDate(`${cell.dateString}T10:00`)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-opacity"
                    title="Schedule post for this date"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Day Posts List */}
              <div className="space-y-1.5 overflow-y-auto max-h-[75px]">
                {dayPosts.map((post) => {
                  const isFailed = post.status === 'failed';
                  const isScheduled = post.status === 'scheduled';
                  const isPublished = post.status === 'published';

                  return (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className={`cursor-pointer rounded-lg p-1.5 text-[11px] border transition-all ${
                        isFailed
                          ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500'
                          : isPublished
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500'
                          : 'border-blue-500/30 bg-blue-500/10 text-blue-200 hover:border-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1">
                          {post.target_platforms.map((plat) => (
                            <span
                              key={plat}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: PLATFORM_CONFIGS[plat]?.color || '#3b82f6' }}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] font-mono text-zinc-400">
                          {post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="truncate font-medium leading-tight">{post.content}</p>
                    </div>
                  );
                })}
              </div>

              {/* Empty state space */}
              {dayPosts.length === 0 && <div className="h-4" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
