import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('displays upstream update badge when available', () => {
    render(<FormulaCard formula={sampleFormula} isAuthenticated={false} />);
    expect(screen.getByText(/Upstream: v1.4.3/i)).toBeDefined();
  });
});
