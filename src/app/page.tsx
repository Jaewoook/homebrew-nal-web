'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { FormulaList } from '@/components/catalog/FormulaList';
import { BuildQueueStream } from '@/components/builds/BuildQueueStream';
import { useBuilds } from '@/hooks/useBuilds';
import { Formula } from '@/types/formula';
import { UserSession } from '@/lib/auth';
import { CheckCircle2, Github, WifiOff } from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'queue'>('catalog');
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loadingFormulas, setLoadingFormulas] = useState(true);
  const [formulasError, setFormulasError] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const {
    runs,
    activeRuns,
    activeBuildingFormulas,
    loading: loadingBuilds,
    error: buildsError,
    refresh: refreshBuilds,
  } = useBuilds(10000);

  // Load initial formulas & session
  async function loadData(showLoading = true) {
    if (showLoading) {
      setLoadingFormulas(true);
    }
    setFormulasError(null);
    try {
      const [formulasRes, sessionRes] = await Promise.all([
        fetch('/api/formulas'),
        fetch('/api/auth/session'),
      ]);

      if (formulasRes.ok) {
        const data = await formulasRes.json();
        const items = data.formulas || [];
        setFormulas(items);
        if (typeof window !== 'undefined' && items.length > 0) {
          try {
            sessionStorage.setItem('nal_cached_formulas', JSON.stringify(items));
          } catch {
            // Ignore storage quota
          }
        }
      } else {
        const errData = await formulasRes.json().catch(() => ({}));
        setFormulasError(
          errData.message || 'Unable to connect to formula repository. You may be offline or rate-limited.'
        );
        setFormulas([]);
      }

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setUser(sessionData.user);
      }
    } catch (err: any) {
      setFormulasError(err?.message || 'Network error: unable to reach the server.');
      setFormulas([]);
    } finally {
      setLoadingFormulas(false);
    }
  }

  useEffect(() => {
    let hasLocalCache = false;
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('nal_cached_formulas');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFormulas(parsed);
            setLoadingFormulas(false);
            hasLocalCache = true;
          }
        }
      } catch {
        // Ignore JSON error
      }
    }

    loadData(!hasLocalCache);

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authError = urlParams.get('auth_error');
      if (authError) {
        setToastMsg(`Authentication failed: ${decodeURIComponent(authError)}`);
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setToastMsg(null), 6000);
      }
    }
  }, []);

  const handleDispatchSuccess = (formulaName: string) => {
    setToastMsg(`Build request for "${formulaName}" successfully dispatched to GitHub Actions!`);
    refreshBuilds();
    // Auto-switch to build queue view to monitor progress as specified in PRD
    setActiveTab('queue');
    setTimeout(() => setToastMsg(null), 5000);
  };

  const handleSessionExpired = () => {
    setUser(null);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        formulaCount={formulas.length}
        activeBuildCount={activeRuns.length}
        user={user}
        onUserChange={setUser}
      />

      {/* Floating success notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-950 border border-emerald-600/50 text-emerald-200 px-4 py-2.5 rounded-lg shadow-xl text-xs animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {activeTab === 'catalog' ? (
          <div>
            {/* Tap Welcome Banner */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-900/90 to-slate-900/40 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    NAL Homelab Package Registry
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Browse, install, and trigger bottle builds for customized tools running across the NAL homelab infrastructure.
                    Binaries are compiled on self-hosted NAL runners and published to GitHub Releases.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <a
                    href="https://github.com/Jaewoook/homebrew-nal"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>Repository</span>
                  </a>
                </div>
              </div>
            </div>

            {loadingFormulas ? (
              <div className="text-center py-16 text-slate-500 text-xs">Loading formula catalog...</div>
            ) : formulasError && formulas.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-red-900/40 rounded-xl bg-red-950/10 p-6 space-y-3">
                <WifiOff className="w-8 h-8 text-red-400/80 mx-auto" />
                <div>
                  <p className="font-semibold text-slate-200 text-sm">Formula catalog is currently unavailable</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{formulasError}</p>
                </div>
                <button
                  onClick={() => loadData(true)}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <FormulaList
                formulas={formulas}
                isAuthenticated={Boolean(user)}
                activeBuildingFormulas={activeBuildingFormulas}
                onDispatchSuccess={handleDispatchSuccess}
                onSessionExpired={handleSessionExpired}
              />
            )}
          </div>
        ) : (
          <BuildQueueStream
            runs={runs}
            loading={loadingBuilds}
            error={buildsError}
            onRefresh={refreshBuilds}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Part of the <strong className="text-slate-400 font-medium">NAL System</strong> infrastructure &bull; Powered by Next.js & Authentik
          </span>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Jaewoook/homebrew-nal"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Jaewoook/homebrew-nal
            </a>
            <span>&bull;</span>
            <a
              href="https://github.com/Jaewoook/NAL"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Jaewoook/NAL
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
