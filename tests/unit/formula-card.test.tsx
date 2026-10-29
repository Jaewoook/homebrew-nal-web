import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FormulaCard } from '@/components/catalog/FormulaCard';

describe('FormulaCard Component', () => {
  const sampleFormula = {
    name: 'nal-core',
    version: '1.4.2',
    upstreamVersion: '1.4.3',
    desc: 'NAL Core Daemon',
    homepage: 'https://nal.internal',
    license: 'MIT',
    dependencies: ['openssl@3'],
    hasBottle: true,
    hasUpdate: true,
  };

  it('renders collapsed state by default and expands on click', () => {
    render(<FormulaCard formula={sampleFormula} isAuthenticated={false} />);
    expect(screen.getByText('nal-core')).toBeDefined();
    expect(screen.queryByText('Dependencies:')).toBeNull();

    // Click to expand inline accordion
    fireEvent.click(screen.getByText('nal-core'));
    expect(screen.getByText('Dependencies:')).toBeDefined();
    expect(screen.getByText('openssl@3')).toBeDefined();
  });

  it('shows Request Sync & Build button only when authenticated and expanded', () => {
    const { rerender } = render(<FormulaCard formula={sampleFormula} isAuthenticated={false} />);
    fireEvent.click(screen.getByText('nal-core'));
    expect(screen.queryByText('Request Sync & Build')).toBeNull();

    rerender(<FormulaCard formula={sampleFormula} isAuthenticated={true} />);
    expect(screen.getByText('Request Sync & Build')).toBeDefined();
  });

  it('disables button when formula is currently building', () => {
    render(<FormulaCard formula={sampleFormula} isAuthenticated={true} isBuilding={true} />);
    fireEvent.click(screen.getByText('nal-core'));

    const button = screen.getByRole('button', { name: /Building in Progress/i });
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('notifies onSessionExpired when dispatch returns 401', async () => {
    const onSessionExpired = vi.fn();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Session expired' }),
    } as Response);

    render(
      <FormulaCard
        formula={sampleFormula}
        isAuthenticated={true}
        onSessionExpired={onSessionExpired}
      />
    );
    fireEvent.click(screen.getByText('nal-core'));

    const button = screen.getByText('Request Sync & Build');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
  });

  it('displays upstream update badge when available', () => {
    render(<FormulaCard formula={sampleFormula} isAuthenticated={false} />);
    expect(screen.getByText(/Upstream: v1.4.3/i)).toBeDefined();
  });

  it('renders release tag and bottle download button when release metadata is present', () => {
    const formulaWithRelease = {
      ...sampleFormula,
      name: 'ffmpeg',
      version: '9.0.2',
      fullVersion: '9.0.2_1',
      releaseTag: 'ffmpeg.9.0.2_1',
      releaseUrl: 'https://github.com/Jaewoook/homebrew-nal/releases/tag/ffmpeg.9.0.2_1',
      bottleUrl: 'https://github.com/Jaewoook/homebrew-nal/releases/download/ffmpeg.9.0.2_1/ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
      bottleFilename: 'ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
      bottleSize: 22173600,
      bottlePlatform: 'sequoia',
      publishedAt: '2026-10-14T16:41:32Z',
    };

    render(<FormulaCard formula={formulaWithRelease} isAuthenticated={false} />);
    fireEvent.click(screen.getByText('ffmpeg'));

    expect(screen.getByText('ffmpeg.9.0.2_1')).toBeDefined();
    const downloadLink = screen.getByRole('link', { name: /Download Bottle/i });
    expect(downloadLink).toBeDefined();
    expect(downloadLink.getAttribute('href')).toBe(formulaWithRelease.bottleUrl);
    expect(screen.getByText(/21\.1 MB/i)).toBeDefined();
    expect(screen.getAllByText(/sequoia/i).length).toBeGreaterThanOrEqual(1);
  });

  it('refuses to render unsafe URL schemes (javascript: or data:) as clickable links', () => {
    const unsafeFormula = {
      ...sampleFormula,
      name: 'unsafe-pkg',
      homepage: 'javascript:alert(document.cookie)',
      releaseTag: 'unsafe-pkg.1.0.0',
      releaseUrl: 'javascript:evil()',
      bottleUrl: 'data:text/html,<script>alert(1)</script>',
    };

    render(<FormulaCard formula={unsafeFormula} isAuthenticated={false} />);
    fireEvent.click(screen.getByText('unsafe-pkg'));

    const links = screen.queryAllByRole('link');
    expect(links.length).toBe(0);
  });
});
