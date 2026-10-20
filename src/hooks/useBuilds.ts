'use client';

import { useState, useEffect, useCallback } from 'react';
import { WorkflowRun } from '@/lib/github-client';

export function useBuilds(pollingIntervalMs = 10000) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBuilds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/builds');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch builds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuilds();
    const interval = setInterval(fetchBuilds, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchBuilds, pollingIntervalMs]);

  const activeRuns = runs.filter((r) => r.status === 'in_progress' || r.status === 'queued');

  const activeBuildingFormulas = runs
    .filter((r) => r.status === 'in_progress' && r.formula)
    .map((r) => r.formula as string);

  return {
    runs,
    activeRuns,
    activeBuildingFormulas,
    loading,
    refresh: fetchBuilds,
  };
}
