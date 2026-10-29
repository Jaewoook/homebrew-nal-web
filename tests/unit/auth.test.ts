import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractUserFromHeaders,
  validateSession,
  createSignedSessionCookie,
  getRequestOrigin,
} from '@/lib/auth';

describe('Auth Session Verification & Signing', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-key-32-chars-long-12345';
    process.env.NODE_ENV = 'development';
  });

  it('ignores arbitrary unauthenticated headers (no mock header bypasses)', () => {
    const headers = new Headers({
      'x-mock-user': 'jaewook',
      'x-mock-email': 'jaewook@nal.local',
    });
    const user = extractUserFromHeaders(headers);
    expect(user).toBeNull();
  });

  it('verifies valid HMAC signed session cookie', () => {
    const user = { name: 'jaewook', email: 'jaewook@nal.local' };
    const cookie = createSignedSessionCookie(user);

    const headers = new Headers({ cookie: `nal_session=${cookie}` });
    const extracted = extractUserFromHeaders(headers);
    expect(extracted).not.toBeNull();
    expect(extracted?.name).toBe('jaewook');
  });

  it('creates signed session cookie with default 18 hours expiration', () => {
    const user = { name: 'jaewook', email: 'jaewook@nal.local' };
    const cookie = createSignedSessionCookie(user);
    const headers = new Headers({ cookie: `nal_session=${cookie}` });
    const extracted = extractUserFromHeaders(headers);

    expect(extracted).not.toBeNull();
    expect(extracted?.iat).toBeDefined();
    expect(extracted?.exp).toBeDefined();
    expect((extracted!.exp!) - (extracted!.iat!)).toBe(18 * 60 * 60);
  });

  it('rejects tampered or unsigned session cookies', () => {
    // Unsigned base64 JSON
    const unsigned = Buffer.from(JSON.stringify({ name: 'attacker' })).toString('base64');
    const headers1 = new Headers({ cookie: `nal_session=${unsigned}` });
    expect(extractUserFromHeaders(headers1)).toBeNull();

    // Tampered payload with invalid signature
    const tampered = `${unsigned}.invalidsignature12345`;
    const headers2 = new Headers({ cookie: `nal_session=${tampered}` });
    expect(extractUserFromHeaders(headers2)).toBeNull();
  });

  it('rejects expired session cookies based on exp timestamp', () => {
    const expiredUser = {
      name: 'jaewook',
      email: 'jaewook@nal.local',
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const expiredCookie = createSignedSessionCookie(expiredUser);
    const headers = new Headers({ cookie: `nal_session=${expiredCookie}` });
    expect(extractUserFromHeaders(headers)).toBeNull();
  });

  it('validates session from request cookie', async () => {
    const cookie = createSignedSessionCookie({ name: 'jaewook', email: 'jaewook@nal.local' });
    const reqWithAuth = new Request('http://localhost:3000/api/test', {
      headers: { cookie: `nal_session=${cookie}` },
    });
    const session = await validateSession(reqWithAuth);
    expect(session).not.toBeNull();
    expect(session?.name).toBe('jaewook');
    expect(session?.email).toBe('jaewook@nal.local');

    const reqWithoutAuth = new Request('http://localhost:3000/api/test');
    const emptySession = await validateSession(reqWithoutAuth);
    expect(emptySession).toBeNull();
  });

  it('throws in production when NEXTAUTH_SECRET is not configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXTAUTH_SECRET;
    expect(() => createSignedSessionCookie({ name: 'jaewook' })).toThrow(/NEXTAUTH_SECRET is required/);
  });

  it('correctly resolves origin from NEXTAUTH_URL or request fallback', () => {
    process.env.NEXTAUTH_URL = 'https://brew.jaewook.dev';
    const req1 = new Request('https://brew.jaewook.dev/api/auth/login');
    expect(getRequestOrigin(req1)).toBe('https://brew.jaewook.dev');

    delete process.env.NEXTAUTH_URL;
    const req2 = new Request('http://localhost:3000/api/auth/login');
    expect(getRequestOrigin(req2)).toBe('http://localhost:3000');
  });

  it('throws in production when NEXTAUTH_URL is not configured and ignores spoofed x-forwarded-host', () => {
    delete process.env.NEXTAUTH_URL;
    const spoofedReq = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-host': 'evil.attacker.com',
        'x-forwarded-proto': 'https',
      },
    });
    expect(getRequestOrigin(spoofedReq)).toBe('http://localhost:3000');

    process.env.NODE_ENV = 'production';
    expect(() => getRequestOrigin(spoofedReq)).toThrow(/NEXTAUTH_URL is required/);
  });
});
