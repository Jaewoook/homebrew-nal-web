import { NextResponse } from 'next/server';
import { createSignedSessionCookie, getOidcEndpoints, getRequestOrigin } from '@/lib/auth';

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');
  const errorParam = reqUrl.searchParams.get('error');

  const origin = getRequestOrigin(request);

  // If Authentik returned an error (e.g. user denied or cancelled), fail cleanly without signing in
  if (errorParam) {
    const errorDesc = reqUrl.searchParams.get('error_description') || errorParam;
    const response = NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(errorDesc)}`,
      307
    );
    response.cookies.delete('nal_auth_state');
    return response;
  }

  const cookieHeader = request.headers.get('cookie');
  const expectedState = getCookie(cookieHeader, 'nal_auth_state');

  // Verify CSRF state
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  const issuer = process.env.AUTHENTIK_ISSUER?.replace(/\/+$/, '');
  const clientId = process.env.AUTHENTIK_CLIENT_ID;
  const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET || '';

  // Endpoint must be configurable via environment variables
  if (!issuer || !clientId) {
    return NextResponse.json(
      { error: 'Authentik OIDC is not configured (missing AUTHENTIK_ISSUER or AUTHENTIK_CLIENT_ID)' },
      { status: 500 }
    );
  }

  const endpoints = await getOidcEndpoints(issuer);
  const redirectUri = `${origin}/api/auth/callback`;

  // Exchange authorization code for tokens with configured Authentik endpoint
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(endpoints.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    // If sign-in fails, do not fall back to signed in state
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token from authentication server' }, { status: 400 });
  }

  // Retrieve user profile from configured Authentik userinfo endpoint
  const userRes = await fetch(endpoints.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 400 });
  }

  const userData = await userRes.json();
  const name = userData.preferred_username || userData.nickname || userData.name;
  if (!name) {
    return NextResponse.json({ error: 'Unable to extract username from Authentik profile' }, { status: 400 });
  }

  const email = userData.email || null;
  const sessionToken = createSignedSessionCookie({ name, email });

  const response = NextResponse.redirect(`${origin}/`, 307);
  response.cookies.set('nal_session', sessionToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.delete('nal_auth_state');

  return response;
}
