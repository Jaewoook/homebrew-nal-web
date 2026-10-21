import { NextResponse } from 'next/server';
import { createSignedSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  // Disallow mock login in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Mock login is disabled in production environments.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const username = body.username || 'jaewook';
    const email = body.email || `${username}@nal.local`;

    const user = { name: username, email };
    const sessionCookie = createSignedSessionCookie(user);

    const response = NextResponse.json({ success: true, user });
    response.cookies.set('nal_session', sessionCookie, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
