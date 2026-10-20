import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username || 'jaewook';
    const email = body.email || `${username}@nal.local`;

    const sessionData = Buffer.from(JSON.stringify({ name: username, email })).toString('base64');

    const response = NextResponse.json({ success: true, user: { name: username, email } });
    response.cookies.set('nal_session', sessionData, {
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
