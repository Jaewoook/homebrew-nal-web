'use client';

import React, { useState, useMemo } from 'react';
import { Formula } from '@/types/formula';
import { FormulaCard } from './FormulaCard';
import { SearchBar } from './SearchBar';

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchBar query={searchQuery} onChange={setSearchQuery} />
        <span className="text-xs text-slate-400 font-mono whitespace-nowrap self-end sm:self-center">
          Showing {filtered.length} of {formulas.length} formulas
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
          No formulas matched &ldquo;{searchQuery}&rdquo;.
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
    </div>
  );
}
