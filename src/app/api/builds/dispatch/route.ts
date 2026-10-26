import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { recordDispatch } from '@/lib/dispatch-store';
import { dispatchSyncWorkflow } from '@/lib/github-client';
import { checkRateLimit } from '@/lib/rate-limiter';

const FORMULA_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9+@._-]{0,63}$/;

export async function POST(request: Request) {
  const user = await validateSession(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be signed in with a NAL account to request builds.' },
      { status: 401 }
    );
  }

  // 1. Rate limiting: max 3 dispatches per 5 minutes per user
  const rateLimit = checkRateLimit(user.name, 3, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${rateLimit.retryAfter} seconds before requesting another build.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter || 60) },
      }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const formula = body?.formula;
  if (
    !formula ||
    typeof formula !== 'string' ||
    !FORMULA_REGEX.test(formula) ||
    formula.includes('..') ||
    formula.includes('/') ||
    formula.includes('\\')
  ) {
    return NextResponse.json(
      { error: 'Invalid formula name', message: 'Formula name contains invalid characters.' },
      { status: 400 }
    );
  }

  // 2. Dispatch GitHub Actions workflow first
  const force = Boolean(body?.force);
  const with_deps = Boolean(body?.with_deps || body?.withDeps);
  const result = await dispatchSyncWorkflow(formula, { force, with_deps });
  if (!result.success) {
    return NextResponse.json(
      { error: 'Dispatch failed', message: result.error },
      { status: 502 }
    );
  }

  // 3. Record dispatch in attribution store only upon successful dispatch
  const record = await recordDispatch(formula, user.name, user.email || undefined);

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
