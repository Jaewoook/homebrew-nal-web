'use client';

import React, { useState, useMemo } from 'react';
import { Formula } from '@/types/formula';
import { FormulaCard } from './FormulaCard';
import { SearchBar } from './SearchBar';
import { SyncUnregisteredModal } from './SyncUnregisteredModal';
import { Plus } from 'lucide-react';

interface FormulaListProps {
  formulas: Formula[];
  isAuthenticated: boolean;
  activeBuildingFormulas?: string[];
  onDispatchSuccess?: (formulaName: string) => void;
  onSessionExpired?: () => void;
}

export function FormulaList({
  formulas,
  isAuthenticated,
  activeBuildingFormulas = [],
  onDispatchSuccess,
  onSessionExpired,
}: FormulaListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialFormula, setModalInitialFormula] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return formulas;
    const q = searchQuery.toLowerCase().trim();
    return formulas.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.dependencies.some((dep) => dep.toLowerCase().includes(q))
    );
  }, [formulas, searchQuery]);

  const handleOpenAddModal = (name = '') => {
    setModalInitialFormula(name);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <SearchBar query={searchQuery} onChange={setSearchQuery} />
          {isAuthenticated && (
            <button
              onClick={() => handleOpenAddModal('')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm shrink-0"
              title="Sync and add an unregistered formula from Homebrew Core"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sync New Formula</span>
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono whitespace-nowrap self-end sm:self-center">
          Showing {filtered.length} of {formulas.length} formulas
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-lg text-slate-400">
          <p className="text-sm font-medium text-slate-300">
            No formula matching &ldquo;{searchQuery}&rdquo; in this tap.
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Looking for an unregistered formula from Homebrew Core? Authenticated users can request to synchronize and add it.
          </p>
          {isAuthenticated ? (
            <button
              onClick={() => handleOpenAddModal(searchQuery.trim())}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Request &ldquo;{searchQuery.trim()}&rdquo; from Upstream</span>
            </button>
          ) : (
            <div className="mt-2.5 text-xs text-slate-500">
              <p className="italic">
                Sign in with your NAL account to request adding &ldquo;{searchQuery.trim()}&rdquo; from upstream to this tap.
              </p>
              <p className="mt-1.5">
                External contributor without an account?{' '}
                <a
                  href={`https://github.com/Jaewoook/homebrew-nal/issues/new?template=new_formula_request.yml&title=%5BFormula+Request%5D%3A+${encodeURIComponent(searchQuery.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Request this formula on GitHub &rarr;
                </a>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((formula) => (
            <FormulaCard
              key={formula.name}
              formula={formula}
              isAuthenticated={isAuthenticated}
              isBuilding={activeBuildingFormulas.includes(formula.name)}
              onDispatchSuccess={onDispatchSuccess}
              onSessionExpired={onSessionExpired}
            />
          ))}
        </div>
      )}

      {/* Sync Unregistered Formula Modal */}
      <SyncUnregisteredModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialFormula={modalInitialFormula}
        onDispatchSuccess={onDispatchSuccess}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
