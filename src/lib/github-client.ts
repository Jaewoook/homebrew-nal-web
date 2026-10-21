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

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'jaewoook';
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
  run: { event?: string; created_at: string },
  recentDispatches: DispatchRecord[]
): { actor: string; formula?: string } {
  if (run.event === 'schedule') {
    return { actor: 'Scheduled Cron' };
  }
  if (run.event === 'push') {
    return { actor: 'Git Push' };
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
    return { actor: 'NAL User (via GitHub)' };
  }

  return { actor: run.event || 'Unknown' };
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

  if (!GITHUB_TOKEN) {
    const mockRuns: WorkflowRun[] = recentDispatches.map((d, index) => ({
      id: 1000 + index,
      name: `Sync & Build: ${d.formula}`,
      formula: d.formula,
      status: index === 0 ? 'in_progress' : 'completed',
      conclusion: index === 0 ? null : 'success',
      actor: `${d.requested_by} (Authentik)`,
      duration: index === 0 ? '1m 24s' : '4m 12s',
      html_url: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs/${1000 + index}`,
      created_at: new Date(d.created_at).toISOString(),
    }));

    if (mockRuns.length === 0) {
      mockRuns.push(
        {
          id: 901,
          name: 'Sync & Build: nal-core',
          formula: 'nal-core',
          status: 'in_progress',
          conclusion: null,
          actor: 'jaewook (Authentik)',
          duration: '1m 45s',
          html_url: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs/901`,
          created_at: new Date(Date.now() - 105000).toISOString(),
        },
        {
          id: 900,
          name: 'Scheduled Tap Sync',
          formula: 'caddy-nal',
          status: 'completed',
          conclusion: 'success',
          actor: 'Scheduled Cron',
          duration: '3m 50s',
          html_url: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs/900`,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        }
      );
    }

    return mockRuns;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs?per_page=30`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const runs = (data.workflow_runs || []).map((run: any) => {
      const { actor, formula } = correlateRunActor(run, recentDispatches);
      const duration = formatRunDuration(
        run.run_started_at || run.created_at,
        run.status === 'completed' ? run.updated_at : undefined
      );

      return {
        id: run.id,
        name: run.name || 'Workflow Run',
        formula,
        status: run.status,
        conclusion: run.conclusion,
        actor,
        duration,
        html_url: run.html_url,
        created_at: run.created_at,
      };
    });

    return runs;
  } catch (err) {
    console.error('Failed to query GitHub workflow runs:', err);
    return [];
  }
}
