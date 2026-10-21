import { getRecentDispatches, DispatchRecord } from './dispatch-store';

export interface WorkflowRun {
  id: number;
  name: string;
  formula?: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  actor: string;
  duration?: string;
  html_url: string;
  created_at: string;
}

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'Jaewoook';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'homebrew-nal';
const GITHUB_SYNC_WORKFLOW = process.env.GITHUB_SYNC_WORKFLOW || 'sync-upstream.yml';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;

export function formatRunDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));

  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function correlateRunActor(
  run: {
    event?: string;
    created_at: string;
    display_title?: string;
    name?: string;
    triggering_actor?: { login?: string };
  },
  recentDispatches: DispatchRecord[]
): { actor: string; formula?: string } {
  // Extract formula from display_title if present (e.g. "Update rust formula to 1.99.1")
  let titleFormula: string | undefined;
  if (run.display_title) {
    const m = run.display_title.match(/(?:Update|Sync|Build)\s+([a-zA-Z0-9_-]+)\s+formula/i);
    if (m) {
      titleFormula = m[1].toLowerCase();
    }
  }

  if (run.event === 'schedule') {
    return { actor: 'Scheduled Cron', formula: titleFormula };
  }
  if (run.event === 'push') {
    const actor = run.triggering_actor?.login;
    return { actor: actor ? `${actor} (Git Push)` : 'Git Push', formula: titleFormula };
  }

  // Only attribute workflow_dispatch events to user dispatches
  if (run.event === 'workflow_dispatch') {
    const runTime = new Date(run.created_at).getTime();
    for (const d of recentDispatches) {
      const diff = Math.abs(runTime - d.created_at);
      if (diff < 1000 * 60 * 30) {
        // Within 30 minutes
        return {
          actor: `${d.requested_by} (Authentik)`,
          formula: d.formula,
        };
      }
    }
    const actor = run.triggering_actor?.login
      ? `${run.triggering_actor.login} (GitHub)`
      : 'NAL User (via GitHub)';
    return { actor, formula: titleFormula };
  }

  return { actor: run.event || 'Unknown', formula: titleFormula };
}

export async function dispatchSyncWorkflow(formula: string): Promise<{ success: boolean; error?: string }> {
  if (!GITHUB_TOKEN) {
    console.info(`[Mock GHA] Dispatched ${GITHUB_SYNC_WORKFLOW} for formula: ${formula}`);
    return { success: true };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_SYNC_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { formula },
        }),
      }
    );

    if (res.status === 204 || res.status === 200 || res.status === 202) {
      return { success: true };
    }

    const errText = await res.text();
    return { success: false, error: `GitHub API error (${res.status}): ${errText}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown network error' };
  }
}

export async function getWorkflowRuns(): Promise<WorkflowRun[]> {
  const recentDispatches = getRecentDispatches(20);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs?per_page=30`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}): ${res.statusText || 'Failed to fetch workflow runs'}`);
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.workflow_runs)) {
    throw new Error('Invalid response format from GitHub Actions API');
  }

  return data.workflow_runs.map((run: any) => {
    const { actor, formula } = correlateRunActor(run, recentDispatches);
    const duration = formatRunDuration(
      run.run_started_at || run.created_at,
      run.status === 'completed' ? run.updated_at : undefined
    );

    return {
      id: run.id,
      name: run.display_title || run.name || 'Workflow Run',
      formula,
      status: run.status,
      conclusion: run.conclusion,
      actor,
      duration,
      html_url: run.html_url,
      created_at: run.created_at,
    };
  });
}
