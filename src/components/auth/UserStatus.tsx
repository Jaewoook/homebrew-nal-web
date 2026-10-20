'use client';

import React, { useState } from 'react';
import { User, LogIn, LogOut } from 'lucide-react';
import { UserSession } from '@/lib/auth';

interface UserStatusProps {
  initialUser?: UserSession | null;
  onUserChange?: (user: UserSession | null) => void;
}

export function UserStatus({ initialUser = null, onUserChange }: UserStatusProps) {
  const [user, setUser] = useState<UserSession | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // If Authentik OIDC configured in production, redirect to Authentik:
    const authentikIssuer = process.env.NEXT_PUBLIC_AUTHENTIK_ISSUER;
    if (authentikIssuer) {
      window.location.href = `/api/auth/login`;
      return;
    }

    // Default: Mock login for dev/testing
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mock-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'jaewook', email: 'jaewook@nal.local' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        onUserChange?.(data.user);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      onUserChange?.(null);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 rounded-full px-3 py-1 text-xs text-emerald-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <User className="w-3.5 h-3.5" />
        <span className="font-medium">{user.name}</span>
        <span className="text-emerald-500/70 text-[10px] hidden sm:inline">(NAL Authentik)</span>
        <button
          onClick={handleLogout}
          disabled={loading}
          title="Sign out"
          className="ml-1 hover:text-red-400 transition-colors p-0.5 rounded cursor-pointer"
        >
          <LogOut className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
    >
      <LogIn className="w-3.5 h-3.5" />
      <span>Sign in with NAL</span>
    </button>
  );
}
