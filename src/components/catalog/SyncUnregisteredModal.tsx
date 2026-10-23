'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, AlertCircle, PlusCircle } from 'lucide-react';

interface SyncUnregisteredModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormula?: string;
  onDispatchSuccess?: (formulaName: string) => void;
  onSessionExpired?: () => void;
}

const FORMULA_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9+@._-]{0,63}$/;

export function SyncUnregisteredModal({
  isOpen,
  onClose,
  initialFormula = '',
  onDispatchSuccess,
  onSessionExpired,
}: SyncUnregisteredModalProps) {
  const [formulaName, setFormulaName] = useState(initialFormula);
  const [force, setForce] = useState(false);
  const [withDeps, setWithDeps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormulaName(initialFormula);
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen, initialFormula]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formulaName.trim();

    if (!cleanName) {
      setErrorMsg('Please enter a formula name.');
      return;
    }

    if (!FORMULA_REGEX.test(cleanName) || cleanName.includes('..')) {
      setErrorMsg('Invalid formula name format. Use letters, numbers, hyphens, underscores, or @.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/builds/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formula: cleanName,
          force,
          with_deps: withDeps,
        }),
      });

      if (res.status === 401) {
        onSessionExpired?.();
        setErrorMsg('Session expired. Please sign in again.');
        return;
      }

      if (res.ok) {
        onDispatchSuccess?.(cleanName);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || 'Failed to dispatch sync request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <PlusCircle className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100">Sync & Add New Formula</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Request an unregistered formula from Homebrew Core (e.g., <code className="text-blue-300">ripgrep</code>,{' '}
            <code className="text-blue-300">deno</code>, <code className="text-blue-300">node@22</code>) to be synchronized into{' '}
            <span className="text-slate-200 font-mono font-medium">jaewoook/homebrew-nal</span> and built on your runner.
          </p>

          <div>
            <label htmlFor="formula-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Formula Name <span className="text-blue-400">*</span>
            </label>
            <input
              id="formula-name-input"
              type="text"
              autoFocus
              value={formulaName}
              onChange={(e) => setFormulaName(e.target.value)}
              placeholder="e.g. ripgrep, deno, uv"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-slate-100 select-none">
              <input
                type="checkbox"
                checked={withDeps}
                onChange={(e) => setWithDeps(e.target.checked)}
                disabled={loading}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <div>
                <span className="font-medium">Resolve runtime dependencies</span>
                <p className="text-[11px] text-slate-500">
                  Automatically adds any missing dependency formulas from upstream into this tap.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-slate-100 select-none">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                disabled={loading}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <div>
                <span className="font-medium">Force sync</span>
                <p className="text-[11px] text-slate-500">
                  Sync and re-generate formula definition even if versions already match.
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formulaName.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Sync & Build</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
