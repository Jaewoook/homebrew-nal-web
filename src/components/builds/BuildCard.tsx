'use client';

import React from 'react';
import { ExternalLink, Clock, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { WorkflowRun } from '@/lib/github-client';

interface BuildCardProps {
  run: WorkflowRun;
}

export function BuildCard({ run }: BuildCardProps) {
  const isRunning = run.status === 'in_progress';
  const isQueued = run.status === 'queued';
  const isSuccess = run.conclusion === 'success';
  const isFailure = run.conclusion === 'failure';

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
          <Play className="w-3 h-3 fill-current" />
          RUNNING
        </span>
      );
    }
    if (isQueued) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          QUEUED
        </span>
      );
    }
    if (isSuccess) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          SUCCESS
        </span>
      );
    }
    if (isFailure) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
          <XCircle className="w-3 h-3" />
          FAILED
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300">
        <AlertCircle className="w-3 h-3" />
        {run.status.toUpperCase()}
      </span>
    );
  };

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isRunning
          ? 'bg-slate-900/90 border-blue-500/40 shadow-md shadow-blue-500/5'
          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          {getStatusBadge()}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">
                {run.formula || run.name}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                #{run.id}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Triggered by: <strong className="text-slate-300 font-medium">{run.actor}</strong>
              </span>
              {run.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {run.duration}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <a
            href={run.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-700/60 transition-colors"
          >
            <span>View Logs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
