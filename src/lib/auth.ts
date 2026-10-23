import crypto from 'crypto';

export interface UserSession {
  name: string;
  email?: string | null;
  image?: string | null;
  iat?: number;
  exp?: number;
}

function getSecretKey(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is required in production environment');
  }
  return secret || 'nal-fallback-secret-key-32-chars-long';
}

export function createSignedSessionCookie(user: UserSession, maxAgeSeconds: number = 18 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const sessionData: UserSession = {
    ...user,
    iat: user.iat ?? now,
    exp: user.exp ?? now + maxAgeSeconds,
  };
  const data = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
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
      // Enforce cryptographic expiration check
      if (typeof user.exp === 'number' && Math.floor(Date.now() / 1000) > user.exp) {
        return null;
      }
      return user;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractUserFromHeaders(headers: Headers): UserSession | null {
  // Cryptographically verified session cookie (issued via Authentik OIDC flow)
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/nal_session=([^;]+)/);
    if (match) {
      return verifySignedSessionCookie(decodeURIComponent(match[1]));
    }
  }

  return null;
}

export interface OidcEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
}

let cachedOidcEndpoints: { issuer: string; endpoints: OidcEndpoints } | null = null;

export async function getOidcEndpoints(issuerUrl: string): Promise<OidcEndpoints> {
  const cleanIssuer = issuerUrl.replace(/\/+$/, '');

  if (cachedOidcEndpoints && cachedOidcEndpoints.issuer === cleanIssuer) {
    return cachedOidcEndpoints.endpoints;
  }

  // 1. Try standard OIDC discovery document (.well-known/openid-configuration)
  try {
    const discoveryUrl = `${cleanIssuer}/.well-known/openid-configuration`;
    const res = await fetch(discoveryUrl).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.authorization_endpoint && data.token_endpoint && data.userinfo_endpoint) {
        const endpoints: OidcEndpoints = {
          authorizationEndpoint: data.authorization_endpoint,
          tokenEndpoint: data.token_endpoint,
          userinfoEndpoint: data.userinfo_endpoint,
        };
        cachedOidcEndpoints = { issuer: cleanIssuer, endpoints };
        return endpoints;
      }
    }
  } catch {
    // Proceed to fallback
  }

  // 2. Authentik pattern: https://<domain>/application/o/<slug>
  // In Authentik, /authorize, /token, and /userinfo are under /application/o/, not the slug
  const authentikMatch = cleanIssuer.match(/^(https?:\/\/[^/]+\/application\/o)\/[^/]+$/);
  if (authentikMatch) {
    const base = authentikMatch[1];
    const endpoints: OidcEndpoints = {
      authorizationEndpoint: `${base}/authorize/`,
      tokenEndpoint: `${base}/token/`,
      userinfoEndpoint: `${base}/userinfo/`,
    };
    cachedOidcEndpoints = { issuer: cleanIssuer, endpoints };
    return endpoints;
  }

  // 3. Generic standard fallback
  const endpoints: OidcEndpoints = {
    authorizationEndpoint: `${cleanIssuer}/authorize`,
    tokenEndpoint: `${cleanIssuer}/token`,
    userinfoEndpoint: `${cleanIssuer}/userinfo`,
  };
  return endpoints;
}

export function getRequestOrigin(request: Request): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/+$/, '');
  }
  const reqUrl = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || reqUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
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
