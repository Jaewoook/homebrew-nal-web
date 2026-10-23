import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SyncUnregisteredModal } from '@/components/catalog/SyncUnregisteredModal';

describe('SyncUnregisteredModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SyncUnregisteredModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders input, checkboxes, and buttons when isOpen is true', () => {
    render(<SyncUnregisteredModal isOpen={true} onClose={vi.fn()} initialFormula="deno" />);

    expect(screen.getByText('Sync & Add New Formula')).toBeDefined();
    const input = screen.getByPlaceholderText('e.g. ripgrep, deno, uv') as HTMLInputElement;
    expect(input.value).toBe('deno');
    expect(screen.getByLabelText(/Resolve runtime dependencies/i)).toBeDefined();
    expect(screen.getByLabelText(/Force sync/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Request Sync & Build/i })).toBeDefined();
  });

  it('validates invalid formula names and shows error', async () => {
    render(<SyncUnregisteredModal isOpen={true} onClose={vi.fn()} initialFormula="" />);

    const submitBtn = screen.getByRole('button', { name: /Request Sync & Build/i });
    const input = screen.getByPlaceholderText('e.g. ripgrep, deno, uv');

    fireEvent.change(input, { target: { value: 'bad/formula/name' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Invalid formula name format/i)).toBeDefined();
  });

  it('dispatches valid unregistered formula sync with selected options', async () => {
    const onDispatchSuccess = vi.fn();
    const onClose = vi.fn();

    let capturedPayload: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) => {
      capturedPayload = JSON.parse(init?.body || '{}');
      return { ok: true, status: 202 } as Response;
    });

    render(
      <SyncUnregisteredModal
        isOpen={true}
        onClose={onClose}
        initialFormula="ripgrep"
        onDispatchSuccess={onDispatchSuccess}
      />
    );

    // Toggle force sync
    const forceCheckbox = screen.getByLabelText(/Force sync/i);
    fireEvent.click(forceCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Request Sync & Build/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onDispatchSuccess).toHaveBeenCalledWith('ripgrep');
      expect(onClose).toHaveBeenCalled();
    });

    expect(capturedPayload).toEqual({
      formula: 'ripgrep',
      force: true,
      with_deps: true,
    });
  });

  it('handles 401 session expiration gracefully', async () => {
    const onSessionExpired = vi.fn();

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response);

    render(
      <SyncUnregisteredModal
        isOpen={true}
        onClose={vi.fn()}
        initialFormula="deno"
        onSessionExpired={onSessionExpired}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Request Sync & Build/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Session expired/i)).toBeDefined();
  });
});
