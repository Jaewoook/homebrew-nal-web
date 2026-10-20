import { describe, it, expect } from 'vitest';
import { extractUserFromHeaders, validateSession } from '@/lib/auth';

describe('Auth Session Verification', () => {
  it('extracts authenticated user from valid mock session headers', () => {
    const headers = new Headers({
      'x-mock-user': 'jaewook',
      'x-mock-email': 'jaewook@nal.local',
    });
    const user = extractUserFromHeaders(headers);
    expect(user).not.toBeNull();
    expect(user?.name).toBe('jaewook');
    expect(user?.email).toBe('jaewook@nal.local');
  });

  it('returns null when unauthenticated headers are passed', () => {
    const headers = new Headers();
    const user = extractUserFromHeaders(headers);
    expect(user).toBeNull();
  });

  it('validates session from request', async () => {
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
