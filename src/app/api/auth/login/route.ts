import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOidcEndpoints, getRequestOrigin } from '@/lib/auth';

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);

  const issuer = process.env.AUTHENTIK_ISSUER?.replace(/\/+$/, '');
  const clientId = process.env.AUTHENTIK_CLIENT_ID;

  // Endpoint must be configurable via environment variables
  if (!issuer || !clientId) {
    if (request.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Authentik OIDC is not configured (missing AUTHENTIK_ISSUER or AUTHENTIK_CLIENT_ID)' },
        { status: 500 }
      );
    }
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent('Authentik OIDC is not configured (missing AUTHENTIK_ISSUER or AUTHENTIK_CLIENT_ID)')}`,
      307
    );
  }

  const redirectUri = `${origin}/api/auth/callback`;
  const state = crypto.randomUUID();

  const endpoints = await getOidcEndpoints(issuer);
  const authUrl = new URL(endpoints.authorizationEndpoint);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl.toString(), 307);
  response.cookies.set('nal_auth_state', state, {
    httpOnly: true,
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
