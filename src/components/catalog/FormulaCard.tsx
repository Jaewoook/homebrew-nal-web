'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Package,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Download,
  Tag,
  Calendar,
} from 'lucide-react';
import { Formula } from '@/types/formula';

interface FormulaCardProps {
  formula: Formula;
  isAuthenticated: boolean;
  isBuilding?: boolean;
  onDispatchSuccess?: (formulaName: string) => void;
  onSessionExpired?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function FormulaCard({
  formula,
  isAuthenticated,
  isBuilding = false,
  onDispatchSuccess,
  onSessionExpired,
}: FormulaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forceSync, setForceSync] = useState(false);
  const [withDeps, setWithDeps] = useState(false);

  const displayVersion = formula.fullVersion || formula.version;
  const installCommand = `brew install jaewoook/nal/${formula.name}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDispatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBuilding) return;

    setDispatching(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/builds/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formula: formula.name,
          force: forceSync,
          with_deps: withDeps,
        }),
      });

      if (res.status === 401) {
        onSessionExpired?.();
        setErrorMsg('Session expired. Please sign in with your NAL account again.');
        return;
      }

      if (res.ok) {
        setDispatched(true);
        onDispatchSuccess?.(formula.name);
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Build request failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setDispatching(false);
    }
  };

  const isButtonDisabled = dispatching || dispatched || isBuilding;

  const getButtonText = () => {
    if (dispatching) return 'Dispatching...';
    if (dispatched) return 'Dispatched ✓';
    if (isBuilding) return 'Building in Progress...';
    return 'Request Sync & Build';
  };

  return (
    <div
      className={`border rounded-lg transition-all duration-200 overflow-hidden bg-slate-900/60 backdrop-blur ${
        isExpanded ? 'border-blue-500/50 shadow-lg shadow-blue-500/5' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Header / Collapsed Summary */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-md bg-slate-800/80 text-blue-400 mt-0.5 sm:mt-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-100 text-base">{formula.name}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                v{displayVersion}
              </span>

              {formula.upstreamVersion && formula.hasUpdate && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  Upstream: v{formula.upstreamVersion}
                </span>
              )}

              {formula.hasBottle && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Bottle{formula.bottlePlatform ? `: ${formula.bottlePlatform}` : ''}
                </span>
              )}

              {isBuilding && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 animate-pulse font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Compiling Bottle...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{formula.desc}</p>
          </div>
        </div>

        <div className="flex items-center self-end sm:self-center gap-2">
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 flex items-center gap-1 transition-colors"
            title="Copy brew install command"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px]">{copied ? 'Copied!' : 'brew install'}</span>
          </button>
          <div className="text-slate-500">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Accordion Body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950/40 space-y-3.5">
          {/* Full description */}
          <div>
            <span className="text-xs font-medium text-slate-400">Description:</span>
            <p className="text-sm text-slate-200 mt-0.5">{formula.desc || 'No description provided.'}</p>
          </div>

          {/* Links & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {formula.homepage && /^https?:\/\//i.test(formula.homepage.trim()) && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Homepage:</span>
                <a
                  href={formula.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 truncate"
                >
                  {formula.homepage} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {formula.license && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>License:</span>
                <span className="text-slate-200 font-mono">{formula.license}</span>
              </div>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <span className="text-xs font-medium text-slate-400">Dependencies:</span>
            {formula.dependencies && formula.dependencies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {formula.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">None (standalone formula)</p>
            )}
          </div>

          {/* Release & Precompiled Bottle Asset */}
          {(formula.releaseTag || formula.bottleUrl) && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-200">GitHub Release:</span>
                  {formula.releaseUrl && /^https?:\/\//i.test(formula.releaseUrl.trim()) ? (
                    <a
                      href={formula.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {formula.releaseTag}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-slate-300">{formula.releaseTag}</span>
                  )}
                </div>

                {formula.publishedAt && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(formula.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {formula.bottleUrl && /^https?:\/\//i.test(formula.bottleUrl.trim()) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">Precompiled Bottle:</span>
                    {formula.bottlePlatform && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {formula.bottlePlatform}
                      </span>
                    )}
                    {formula.bottleSize && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatBytes(formula.bottleSize)}
                      </span>
                    )}
                  </div>

                  <a
                    href={formula.bottleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 hover:text-emerald-300 border border-slate-700/60 transition-colors w-fit"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Bottle</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Install Command Snippet */}
          <div className="bg-slate-950 border border-slate-800 rounded p-2.5 flex items-center justify-between font-mono text-xs text-emerald-400">
            <span className="truncate">{installCommand}</span>
            <button
              onClick={handleCopy}
              className="ml-2 text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Action Trigger Box */}
          <div className="pt-2 border-t border-slate-800/60">
            {isAuthenticated ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-950/30 border border-blue-900/40 rounded-lg p-3">
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Request Sync & Build (NAL User)
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Triggers <code>sync-upstream.yml</code> on <code>Jaewoook/homebrew-nal</code> to compile on your NAL runner.
                    </p>
                  </div>

                  {/* Additional parameters: force & with_deps */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-100 select-none">
                      <input
                        type="checkbox"
                        checked={forceSync}
                        onChange={(e) => setForceSync(e.target.checked)}
                        disabled={isButtonDisabled}
                        className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                      />
                      <span>Force sync</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-100 select-none">
                      <input
                        type="checkbox"
                        checked={withDeps}
                        onChange={(e) => setWithDeps(e.target.checked)}
                        disabled={isButtonDisabled}
                        className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                      />
                      <span>Resolve dependencies</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={handleDispatch}
                    disabled={isButtonDisabled}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      dispatched
                        ? 'bg-emerald-600 text-white'
                        : isBuilding
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                        : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                    }`}
                  >
                    {dispatching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{getButtonText()}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Sign in with your NAL account to request formula sync and trigger runner bottle builds.
              </p>
            )}

            {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
