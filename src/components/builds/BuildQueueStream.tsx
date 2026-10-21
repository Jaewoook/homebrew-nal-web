'use client';

import React from 'react';
import { RotateCw, Activity, CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react';
import { WorkflowRun } from '@/lib/github-client';
import { BuildCard } from './BuildCard';

interface BuildQueueStreamProps {
  runs: WorkflowRun[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}

export function BuildQueueStream({ runs, loading, error, onRefresh }: BuildQueueStreamProps) {
  const activeRuns = runs.filter((r) => r.status === 'in_progress' || r.status === 'queued');
  const pastRuns = runs.filter((r) => r.status !== 'in_progress' && r.status !== 'queued');

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-100">Live Build Activity Stream</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {runs.length} total runs
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Offline / Error Banner when error occurs on top of existing runs */}
      {error && runs.length > 0 && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-200">Unable to sync build activity</h4>
              <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="px-2.5 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 transition-colors cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* If error occurred and there are no cached runs, display prominent offline message */}
      {runs.length === 0 && error ? (
        <div className="text-center py-12 border border-dashed border-red-900/40 rounded-lg text-slate-400 text-sm bg-red-950/10 space-y-3">
          <WifiOff className="w-8 h-8 text-red-400/80 mx-auto" />
          <div>
            <p className="font-semibold text-slate-200">Build queue is currently unavailable</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={onRefresh}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Active & Queued Builds */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Active Queue & Running Jobs ({activeRuns.length})
              </h3>
            </div>

            {activeRuns.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs bg-slate-950/20">
                No active builds running at this moment. NAL runners are idle.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeRuns.map((run) => (
                  <BuildCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Build History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Completed Builds ({pastRuns.length})
              </h3>
            </div>

            {pastRuns.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
                No past build history available.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pastRuns.map((run) => (
                  <BuildCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
