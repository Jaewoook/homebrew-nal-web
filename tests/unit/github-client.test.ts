import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatRunDuration,
  correlateRunActor,
  getWorkflowRuns,
  dispatchSyncWorkflow,
} from '@/lib/github-client';

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

  it('dispatchSyncWorkflow fails if GITHUB_TOKEN is not configured', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    const originalPat = process.env.GITHUB_PAT;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PAT;

    try {
      const result = await dispatchSyncWorkflow('ffmpeg-nal');
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub Token is not configured');
    } finally {
      if (originalToken) process.env.GITHUB_TOKEN = originalToken;
      if (originalPat) process.env.GITHUB_PAT = originalPat;
    }
  });

  it('dispatchSyncWorkflow sends dispatch POST request with auth bearer token', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-token-123';
    let requestedUrl = '';
    let requestHeaders: any = {};
    let requestBody: any = {};

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
      requestedUrl = String(url);
      requestHeaders = init?.headers;
      requestBody = JSON.parse(init?.body || '{}');
      return { status: 204, ok: true } as Response;
    });

    try {
      const result = await dispatchSyncWorkflow('ffmpeg-nal');
      expect(result.success).toBe(true);
      expect(requestedUrl).toContain('/actions/workflows/sync-upstream.yml/dispatches');
      expect(requestHeaders['Authorization']).toBe('Bearer test-token-123');
      expect(requestBody.inputs).toEqual({ formula: 'ffmpeg-nal' });
    } finally {
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    }
  });

  it('dispatchSyncWorkflow handles GitHub API failure response', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-token-123';
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 403,
      ok: false,
      text: async () => 'Resource not accessible by personal access token',
    } as Response);

    try {
      const result = await dispatchSyncWorkflow('ffmpeg-nal');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource not accessible');
    } finally {
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    }
  });
});
