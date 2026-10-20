export interface UserSession {
  name: string;
  email?: string | null;
  image?: string | null;
}

export function extractUserFromHeaders(headers: Headers): UserSession | null {
  // 1. Direct proxy forward-auth / mock headers
  const mockUser = headers.get('x-mock-user');
  if (mockUser) {
    return {
      name: mockUser,
      email: headers.get('x-mock-email') || null,
    };
  }

  // 2. Authentik Forward-Auth proxy headers (e.g., from Traefik / Caddy Authentik outpost)
  const authentikUser = headers.get('x-authentik-username') || headers.get('x-forwarded-user');
  if (authentikUser) {
    return {
      name: authentikUser,
      email: headers.get('x-authentik-email') || null,
    };
  }

  // 3. Cookie based session (nal_session cookie)
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/nal_session=([^;]+)/);
    if (match) {
      try {
        const decoded = Buffer.from(decodeURIComponent(match[1]), 'base64').toString('utf-8');
        const session = JSON.parse(decoded) as UserSession;
        if (session && session.name) {
          return session;
        }
      } catch (err) {
        // invalid session cookie
      }
    }
  }

  return null;
}

export async function validateSession(request: Request): Promise<UserSession | null> {
  return extractUserFromHeaders(request.headers);
}

export async function getAuthSession(): Promise<UserSession | null> {
  if (typeof window !== 'undefined') {
    // Client-side session check
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        return (await res.json()) as UserSession;
      }
    } catch {
      return null;
    }
    return null;
  }
  return null;
}
