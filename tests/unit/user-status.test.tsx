import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UserStatus } from '@/components/auth/UserStatus';

describe('UserStatus Component', () => {
  it('renders "Sign in with NAL" when user is null', () => {
    const onUserChange = vi.fn();
    render(<UserStatus user={null} onUserChange={onUserChange} />);
    expect(screen.getByText(/Sign in with NAL/i)).toBeDefined();
  });

  it('renders authenticated user name and badge when user is logged in', () => {
    const user = { name: 'jaewook', email: 'jaewook@nal.local' };
    const onUserChange = vi.fn();
    render(<UserStatus user={user} onUserChange={onUserChange} />);
    expect(screen.getByText('jaewook')).toBeDefined();
    expect(screen.getByText(/NAL Authentik/i)).toBeDefined();
  });

  it('updates display immediately when user prop changes from null to authenticated user', () => {
    const onUserChange = vi.fn();
    const { rerender } = render(<UserStatus user={null} onUserChange={onUserChange} />);
    expect(screen.getByText(/Sign in with NAL/i)).toBeDefined();

    // Simulate session loading completing
    rerender(<UserStatus user={{ name: 'alex', email: 'alex@nal.local' }} onUserChange={onUserChange} />);
    expect(screen.getByText('alex')).toBeDefined();
    expect(screen.queryByText(/Sign in with NAL/i)).toBeNull();
  });
});
