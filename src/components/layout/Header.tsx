'use client';

import React, { useState } from 'react';
import { Beer, Copy, Check, Terminal, Layers, Activity } from 'lucide-react';
import { UserStatus } from '@/components/auth/UserStatus';
import { UserSession } from '@/lib/auth';

interface HeaderProps {
  activeTab: 'catalog' | 'queue';
  onTabChange: (tab: 'catalog' | 'queue') => void;
  formulaCount: number;
  activeBuildCount: number;
  user: UserSession | null;
  onUserChange: (user: UserSession | null) => void;
}

export function Header({
  activeTab,
  onTabChange,
  formulaCount,
  activeBuildCount,
  user,
  onUserChange,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const tapCommand = 'brew tap jaewoook/nal';

  const handleCopyTap = () => {
    navigator.clipboard.writeText(tapCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand & Tap Command */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Beer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-1.5 leading-none">
                jaewoook<span className="text-slate-500">/</span>homebrew-nal
              </h1>
              <span className="text-[11px] text-slate-400">NAL Homelab macOS & Linux Tap</span>
            </div>
          </div>

          <button
            onClick={handleCopyTap}
            className="flex items-center gap-1.5 text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
            title="Click to copy brew tap command"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>{tapCommand}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Center/Right: Navigation Tabs & Auth Profile */}
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
          <nav className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => onTabChange('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Formulas</span>
              <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {formulaCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('queue')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Build Queue</span>
              {activeBuildCount > 0 ? (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500 text-white animate-pulse">
                  {activeBuildCount}
                </span>
              ) : (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                  0
                </span>
              )}
            </button>
          </nav>

          <UserStatus initialUser={user} onUserChange={onUserChange} />
        </div>
      </div>
    </header>
  );
}
