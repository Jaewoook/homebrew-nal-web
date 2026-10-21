import { NextResponse } from 'next/server';
import { getWorkflowRuns } from '@/lib/github-client';

export async function GET() {
  try {
    const runs = await getWorkflowRuns();
    return NextResponse.json({ runs, total: runs.length });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch build runs',
        message: error?.message || 'Unable to connect to GitHub Actions API. You may be offline or rate-limited.',
        runs: [],
        total: 0,
      },
      { status: 502 }
    );
  }
}
