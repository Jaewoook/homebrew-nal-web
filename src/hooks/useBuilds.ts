'use client';

import { useState, useEffect, useCallback } from 'react';
import { WorkflowRun } from '@/lib/github-client';

export function useBuilds(pollingIntervalMs = 10000) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBuilds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/builds');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Unable to connect to GitHub Actions API. You may be offline or rate-limited.');
        setRuns([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error: unable to reach the server.');
      setRuns([]);
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
    error,
    refresh: fetchBuilds,
  };
}
