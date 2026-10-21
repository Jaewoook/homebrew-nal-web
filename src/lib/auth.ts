import crypto from 'crypto';

export interface UserSession {
  name: string;
  email?: string | null;
  image?: string | null;
}

function getSecretKey(): string {
  return process.env.NEXTAUTH_SECRET || 'nal-fallback-secret-key-32-chars-long';
}

export function createSignedSessionCookie(user: UserSession): string {
  const data = Buffer.from(JSON.stringify(user)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifySignedSessionCookie(cookieValue: string): UserSession | null {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getSecretKey())
    .update(data)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return null;
  const isMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isMatch) return null;

  try {
    const jsonStr = Buffer.from(data, 'base64url').toString('utf-8');
    const user = JSON.parse(jsonStr) as UserSession;
    if (user && user.name) {
      return user;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractUserFromHeaders(headers: Headers): UserSession | null {
  // 1. Direct proxy mock headers - ONLY in development / test mode
  if (process.env.NODE_ENV !== 'production') {
    const mockUser = headers.get('x-mock-user');
    if (mockUser) {
      return {
        name: mockUser,
        email: headers.get('x-mock-email') || null,
      };
    }
  }

  // 2. Authentik Forward-Auth proxy headers (from Traefik / Caddy Authentik outpost)
  const authentikUser = headers.get('x-authentik-username') || headers.get('x-forwarded-user');
  if (authentikUser) {
    return {
      name: authentikUser,
      email: headers.get('x-authentik-email') || null,
    };
  }

  // 3. Cryptographically verified session cookie
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/nal_session=([^;]+)/);
    if (match) {
      return verifySignedSessionCookie(decodeURIComponent(match[1]));
    }
  }

  return null;
}

export async function validateSession(request: Request): Promise<UserSession | null> {
  return extractUserFromHeaders(request.headers);
}

export async function getAuthSession(): Promise<UserSession | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        return data.user || null;
      }
    } catch {
      return null;
    }
  }
  return null;
}
