import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BuildCard } from '@/components/builds/BuildCard';
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
