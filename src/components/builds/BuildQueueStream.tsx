'use client';

import React from 'react';
import { RotateCw, Activity, CheckCircle2 } from 'lucide-react';
import { WorkflowRun } from '@/lib/github-client';
import { BuildCard } from './BuildCard';

interface BuildQueueStreamProps {
  runs: WorkflowRun[];
  loading: boolean;
  onRefresh: () => void;
}

export function BuildQueueStream({ runs, loading, onRefresh }: BuildQueueStreamProps) {
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
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

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
    </div>
  );
}
