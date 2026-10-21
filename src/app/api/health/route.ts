import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'homebrew-nal-web',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
