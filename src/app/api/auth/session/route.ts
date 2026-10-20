import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await validateSession(request);
  return NextResponse.json({ user });
}
