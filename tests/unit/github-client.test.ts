import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatRunDuration, correlateRunActor } from '@/lib/github-client';

describe('GitHub Client Utilities', () => {
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
});
