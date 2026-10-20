import { NextResponse } from 'next/server';
import { getWorkflowRuns } from '@/lib/github-client';

export async function GET() {
  try {
    const runs = await getWorkflowRuns();
    return NextResponse.json({ runs, total: runs.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch build runs', message: error.message },
      { status: 500 }
    );
  }
}
