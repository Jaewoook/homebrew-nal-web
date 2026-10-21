import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatRunDuration, correlateRunActor, getWorkflowRuns } from '@/lib/github-client';

describe('GitHub Client Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats duration between two timestamps', () => {
    const start = new Date(Date.now() - 125000).toISOString(); // 2m 5s ago
    const end = new Date().toISOString();
    const duration = formatRunDuration(start, end);
    expect(duration).toBe('2m 5s');
  });

  it('attributes workflow_dispatch events to matching dispatch record', () => {
    const dispatches = [
      {
        id: '1',
        formula: 'ffmpeg-nal',
        requested_by: 'jaewook',
        created_at: Date.now() - 60000,
        status: 'dispatched',
      },
    ];

    const run = {
      event: 'workflow_dispatch',
      created_at: new Date().toISOString(),
    };

    const result = correlateRunActor(run, dispatches);
    expect(result.actor).toBe('jaewook (Authentik)');
    expect(result.formula).toBe('ffmpeg-nal');
  });

  it('extracts formula from run display_title when available', () => {
    const run = {
      event: 'push',
      created_at: new Date().toISOString(),
      display_title: 'Update rust formula to 1.99.1',
      triggering_actor: { login: 'Jaewoook' },
    };

    const result = correlateRunActor(run, []);
    expect(result.formula).toBe('rust');
    expect(result.actor).toBe('Jaewoook (Git Push)');
  });

  it('does NOT attribute schedule or push events to user dispatches', () => {
    const dispatches = [
      {
        id: '1',
        formula: 'ffmpeg-nal',
        requested_by: 'jaewook',
        created_at: Date.now() - 60000,
        status: 'dispatched',
      },
    ];

    const cronRun = {
      event: 'schedule',
      created_at: new Date().toISOString(),
    };
    expect(correlateRunActor(cronRun, dispatches).actor).toBe('Scheduled Cron');

    const pushRun = {
      event: 'push',
      created_at: new Date().toISOString(),
    };
    expect(correlateRunActor(pushRun, dispatches).actor).toBe('Git Push');
  });

  it('fetches workflow runs from GitHub API and formats them', async () => {
    const mockApiResponse = {
      workflow_runs: [
        {
          id: 39617791811,
          name: 'Build and Release Bottle',
          display_title: 'Update rust formula to 1.99.1',
          status: 'completed',
          conclusion: 'success',
          event: 'push',
          html_url: 'https://github.com/Jaewoook/homebrew-nal/actions/runs/39617791811',
          created_at: '2026-10-21T14:33:09Z',
          updated_at: '2026-10-21T14:33:18Z',
          triggering_actor: { login: 'Jaewoook' },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const runs = await getWorkflowRuns();
    expect(runs.length).toBe(1);
    expect(runs[0].id).toBe(39617791811);
    expect(runs[0].formula).toBe('rust');
    expect(runs[0].status).toBe('completed');
    expect(runs[0].conclusion).toBe('success');
    expect(runs[0].duration).toBe('9s');
  });

  it('throws an error when GitHub API fails or is unavailable instead of returning mock runs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(getWorkflowRuns()).rejects.toThrow(/GitHub API error/i);
  });
});
