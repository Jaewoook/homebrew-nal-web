import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as loginHandler } from '@/app/api/auth/login/route';
import { GET as callbackHandler } from '@/app/api/auth/callback/route';
import { GET as sessionHandler } from '@/app/api/auth/session/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { createSignedSessionCookie } from '@/lib/auth';

describe('Authentication API Routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_SECRET = 'test-secret-key-32-chars-long-12345';
  });

  describe('GET /api/auth/login', () => {
    it('redirects to configured Authentik authorization URL with CSRF state cookie', async () => {
      process.env.AUTHENTIK_ISSUER = 'https://auth.custom-domain.example/application/o/homebrew-nal/';
      process.env.AUTHENTIK_CLIENT_ID = 'custom-client-id';
      process.env.NEXTAUTH_URL = 'https://brew.nal.local';

      const req = new Request('https://brew.nal.local/api/auth/login');
      const res = await loginHandler(req);

      expect(res.status).toBe(307); // Redirect to Authentik
      const location = res.headers.get('location');
      expect(location).toContain('https://auth.custom-domain.example/application/o/authorize');
      expect(location).toContain('client_id=custom-client-id');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fbrew.nal.local%2Fapi%2Fauth%2Fcallback');
      expect(location).toContain('response_type=code');
      expect(location).toContain('scope=openid+profile+email');
      expect(location).toContain('state=');

      // State cookie should be set for CSRF protection
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('nal_auth_state=');
      // Must NOT set a session cookie on login redirect
      expect(setCookie).not.toContain('nal_session=');
    });

    it('handles unconfigured Authentik gracefully by redirecting with auth_error and never creating session', async () => {
      delete process.env.AUTHENTIK_ISSUER;
      delete process.env.AUTHENTIK_CLIENT_ID;

      const req = new Request('http://localhost:3000/api/auth/login');
      const res = await loginHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('auth_error=');
      expect(location).not.toContain('/authorize');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie || '').not.toContain('nal_session=');
    });

    it('returns 500 JSON when accept: application/json and Authentik is unconfigured', async () => {
      delete process.env.AUTHENTIK_ISSUER;
      delete process.env.AUTHENTIK_CLIENT_ID;

      const req = new Request('http://localhost:3000/api/auth/login', {
        headers: { accept: 'application/json' },
      });
      const res = await loginHandler(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('not configured');
    });
  });

  describe('GET /api/auth/callback', () => {
    it('exchanges code for tokens, creates session cookie, and redirects to /', async () => {
      process.env.AUTHENTIK_ISSUER = 'https://auth.custom-domain.example/application/o/homebrew-nal/';
      process.env.AUTHENTIK_CLIENT_ID = 'custom-client-id';
      process.env.AUTHENTIK_CLIENT_SECRET = 'secret123';
      process.env.NEXTAUTH_URL = 'https://brew.nal.local';

      // Mock token endpoint and userinfo endpoint
      vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        const u = String(url);
        if (u.includes('/token')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'mock-access-token',
              token_type: 'Bearer',
            }),
          } as Response;
        }
        if (u.includes('/userinfo')) {
          return {
            ok: true,
            json: async () => ({
              preferred_username: 'jaewook',
              email: 'jaewook@nal.local',
              name: 'Jaewook Ahn',
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const state = 'test-csrf-state-12345';
      const req = new Request(`https://brew.nal.local/api/auth/callback?code=mock-code&state=${state}`, {
        headers: { cookie: `nal_auth_state=${state}` },
      });

      const res = await callbackHandler(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://brew.nal.local/');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('nal_session=');
    });

    it('rejects callback when state does not match cookie', async () => {
      process.env.AUTHENTIK_ISSUER = 'https://auth.custom-domain.example/application/o/homebrew-nal/';
      process.env.AUTHENTIK_CLIENT_ID = 'custom-client-id';

      const req = new Request('https://brew.nal.local/api/auth/callback?code=mock-code&state=wrong-state', {
        headers: { cookie: 'nal_auth_state=expected-state' },
      });

      const res = await callbackHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid state');
    });

    it('does not create session and returns error when token exchange fails', async () => {
      process.env.AUTHENTIK_ISSUER = 'https://auth.custom-domain.example/application/o/homebrew-nal/';
      process.env.AUTHENTIK_CLIENT_ID = 'custom-client-id';
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return { ok: false, status: 400 } as Response;
      });

      const state = 'test-csrf-state-failed';
      const req = new Request(`https://brew.nal.local/api/auth/callback?code=bad-code&state=${state}`, {
        headers: { cookie: `nal_auth_state=${state}` },
      });

      const res = await callbackHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Token exchange failed');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie || '').not.toContain('nal_session=');
    });

    it('does not create session and redirects with error when Authentik callback has error param', async () => {
      process.env.AUTHENTIK_ISSUER = 'https://auth.custom-domain.example/application/o/homebrew-nal/';
      process.env.NEXTAUTH_URL = 'https://brew.nal.local';

      const req = new Request('https://brew.nal.local/api/auth/callback?error=access_denied&error_description=User+cancelled');
      const res = await callbackHandler(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('auth_error=User%20cancelled');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie || '').not.toContain('nal_session=');
    });

    it('returns 500 when callback is called without AUTHENTIK_ISSUER configured', async () => {
      delete process.env.AUTHENTIK_ISSUER;
      delete process.env.AUTHENTIK_CLIENT_ID;

      const state = 'test-csrf-state';
      const req = new Request(`https://brew.nal.local/api/auth/callback?code=some-code&state=${state}`, {
        headers: { cookie: `nal_auth_state=${state}` },
      });

      const res = await callbackHandler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('not configured');
    });
  });

  describe('GET /api/auth/session', () => {
    it('returns null user when unauthenticated', async () => {
      const req = new Request('http://localhost:3000/api/auth/session');
      const res = await sessionHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeNull();
    });

    it('returns user from valid nal_session cookie', async () => {
      const user = { name: 'jaewook', email: 'jaewook@nal.local' };
      const cookie = createSignedSessionCookie(user);

      const req = new Request('http://localhost:3000/api/auth/session', {
        headers: { cookie: `nal_session=${cookie}` },
      });
      const res = await sessionHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toEqual(user);
    });

    it('does not accept unverified forward-auth headers in production', async () => {
      process.env.NODE_ENV = 'production';
      const req = new Request('http://localhost:3000/api/auth/session', {
        headers: {
          'x-authentik-username': 'attacker',
          'x-authentik-email': 'attacker@nal.local',
        },
      });
      const res = await sessionHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeNull();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears nal_session cookie', async () => {
      const req = new Request('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await logoutHandler(req);
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('nal_session=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});
