import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BuildCard } from '@/components/builds/BuildCard';
import { BuildQueueStream } from '@/components/builds/BuildQueueStream';
import { WorkflowRun } from '@/lib/github-client';

describe('BuildCard Component', () => {
  const sampleRun: WorkflowRun = {
    id: 101,
    name: 'Sync & Build: ffmpeg-nal',
    formula: 'ffmpeg-nal',
    status: 'in_progress',
    conclusion: null,
    actor: 'Jaewook (Authentik)',
    duration: '2m 14s',
    html_url: 'https://github.com/jaewoook/homebrew-nal/actions/runs/101',
    created_at: new Date().toISOString(),
  };

  it('renders active running build card with duration and logs link', () => {
    render(<BuildCard run={sampleRun} />);
    expect(screen.getByText('ffmpeg-nal')).toBeDefined();
    expect(screen.getByText(/RUNNING/i)).toBeDefined();
    expect(screen.getByText(/Jaewook \(Authentik\)/)).toBeDefined();
    expect(screen.getByText(/View Logs/i)).toBeDefined();
  });

  it('renders completed success build card with status badge', () => {
    const successRun: WorkflowRun = {
      ...sampleRun,
      id: 102,
      status: 'completed',
      conclusion: 'success',
      duration: '4m 30s',
    };

    render(<BuildCard run={successRun} />);
    expect(screen.getByText(/SUCCESS/i)).toBeDefined();
  });
});

describe('BuildQueueStream Component - Error & Offline State', () => {
  it('renders offline/error message when fetch fails and does NOT show mock items', () => {
    const onRefresh = vi.fn();
    render(
      <BuildQueueStream
        runs={[]}
        loading={false}
        error="Unable to connect to GitHub Actions API. You may be offline or rate-limited."
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText(/Build queue is currently unavailable/i)).toBeDefined();
    expect(screen.getByText(/Unable to connect to GitHub Actions API/i)).toBeDefined();
    expect(screen.queryByText('Sync & Build: ffmpeg')).toBeNull();
    expect(screen.queryByText('Scheduled Tap Sync')).toBeNull();

    // Verify retry button calls onRefresh
    const retryBtn = screen.getByRole('button', { name: /Try Again|Retry/i });
    fireEvent.click(retryBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
