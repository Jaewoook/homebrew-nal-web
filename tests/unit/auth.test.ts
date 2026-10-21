import { describe, it, expect, beforeEach } from 'vitest';
import { extractUserFromHeaders, validateSession, createSignedSessionCookie } from '@/lib/auth';

describe('Auth Session Verification & Signing', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-key-32-chars-long-12345';
    process.env.NODE_ENV = 'development';
  });

  it('extracts user from mock headers in development mode', () => {
    process.env.NODE_ENV = 'development';
    const headers = new Headers({
      'x-mock-user': 'jaewook',
      'x-mock-email': 'jaewook@nal.local',
    });
    const user = extractUserFromHeaders(headers);
    expect(user).not.toBeNull();
    expect(user?.name).toBe('jaewook');
  });

  it('rejects mock headers when not in development', () => {
    process.env.NODE_ENV = 'production';
    const headers = new Headers({
      'x-mock-user': 'attacker',
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

  it('validates session from request', async () => {
    process.env.NODE_ENV = 'development';
    const reqWithAuth = new Request('http://localhost:3000/api/test', {
      headers: { 'x-mock-user': 'jaewook' },
    });
    const session = await validateSession(reqWithAuth);
    expect(session).not.toBeNull();
    expect(session?.name).toBe('jaewook');

    const reqWithoutAuth = new Request('http://localhost:3000/api/test');
    const emptySession = await validateSession(reqWithoutAuth);
    expect(emptySession).toBeNull();
  });
});
