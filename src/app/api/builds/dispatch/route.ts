import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { recordDispatch } from '@/lib/dispatch-store';
import { dispatchSyncWorkflow } from '@/lib/github-client';

const FORMULA_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export async function POST(request: Request) {
  const user = await validateSession(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be signed in with a NAL account to request builds.' },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const formula = body?.formula;
  if (!formula || typeof formula !== 'string' || !FORMULA_REGEX.test(formula)) {
    return NextResponse.json(
      { error: 'Invalid formula name', message: 'Formula name contains invalid characters.' },
      { status: 400 }
    );
  }

  // 1. Record dispatch in local SQLite attribution store
  const record = recordDispatch(formula, user.name, user.email || undefined);

  // 2. Dispatch GitHub Actions workflow
  const result = await dispatchSyncWorkflow(formula);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Dispatch failed', message: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      id: record.id,
      formula: record.formula,
      requested_by: record.requested_by,
      message: `Build request for ${formula} dispatched to GitHub Actions.`,
    },
    { status: 202 }
  );
}
