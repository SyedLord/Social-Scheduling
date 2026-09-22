import React, { useEffect, useState } from 'react';
import {
  Terminal,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { DispatchLog, PLATFORM_CONFIGS, Workspace } from '../types';

interface DispatchLogsViewProps {
  workspace: Workspace;
  onRefreshData: () => Promise<void>;
}

export const DispatchLogsView: React.FC<DispatchLogsViewProps> = ({ workspace, onRefreshData }) => {
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'failure' | 'success'>('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${workspace.id}/logs`);
      const json = await res.json();
      setLogs(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [workspace.id]);

  const handleManualTrigger = async () => {
    try {
      setTriggering(true);
      setTriggerResult(null);
      const res = await fetch('/api/scheduler/trigger', { method: 'POST' });
      const data = await res.json();
      setTriggerResult(
        `Worker ran: processed ${data.processedCount || 0} scheduled post(s) immediately.`
      );
      await fetchLogs();
      await onRefreshData();
    } catch (e: any) {
      setTriggerResult(`Failed: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true;
    return l.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-blue-400" />
            <span>Dispatch Engine Worker & Diagnostics</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time background scheduler worker audit logs, execution metrics, and actionable failure captures.
          </p>
        </div>

        {/* Engine Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleManualTrigger}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md shadow-emerald-600/20"
          >
            <Play className={`h-3.5 w-3.5 ${triggering ? 'animate-spin' : ''}`} />
            <span>{triggering ? 'Dispatching...' : 'Trigger Worker Now'}</span>
          </button>
        </div>
      </div>

      {triggerResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{triggerResult}</span>
        </div>
      )}

      {/* Engine Status Banner */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">
              Background Scheduler Daemon: Running Active
            </div>
            <div className="text-[11px] text-zinc-400">
              Poll Interval: Every 10 seconds • Rate-limiting & Token Expiration Sentinel Active
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Logs ({logs.length})
          </button>
          <button
            onClick={() => setFilter('failure')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'failure' ? 'bg-red-500/20 text-red-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Errors ({logs.filter((l) => l.status === 'failure').length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'success' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Success ({logs.filter((l) => l.status === 'success').length})
          </button>
        </div>
      </div>

      {/* Logs Table / Card list */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
            No logs found matching filter.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isSuccess = log.status === 'success';
            const isFailure = log.status === 'failure';
            const cfg = PLATFORM_CONFIGS[log.platform];

            return (
              <div
                key={log.id}
                className={`rounded-2xl border p-4 transition-all ${
                  isFailure
                    ? 'border-red-500/30 bg-red-950/10'
                    : 'border-zinc-800/80 bg-zinc-900/50'
                } space-y-2`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                      style={{ backgroundColor: cfg?.color || '#3b82f6' }}
                    >
                      {log.platform === 'twitter' ? 'X' : log.platform}
                    </span>

                    {isSuccess ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>DISPATCH SUCCESS</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>DISPATCH FAILED ({log.error_code || 'ERROR'})</span>
                      </span>
                    )}

                    {log.account_handle && (
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {log.account_handle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span>Latency: <strong className="text-zinc-200 font-mono">{log.execution_time_ms}ms</strong></span>
                    <span>•</span>
                    <span className="font-mono text-zinc-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Log message / title */}
                <div className="text-xs text-zinc-200 font-medium">
                  {log.post_title || 'Dispatched queued post'}
                </div>

                {/* Error diagnostics banner */}
                {isFailure && log.error_message && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 space-y-1">
                    <div className="font-semibold text-red-200">
                      Root Cause: {log.error_message}
                    </div>
                    <div className="text-[11px] text-red-400">
                      Recommendation: Go to Connected Channels to re-authenticate or adjust post length in Composer.
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
