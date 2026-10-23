import { NextResponse } from 'next/server';
import { getFormulaCatalog } from '@/lib/formula-service';

let lastForceRefreshTimestamp = 0;
const FORCE_REFRESH_COOLDOWN_MS = 60 * 1000; // 60 seconds minimum interval

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsRefresh = url.searchParams.get('refresh') === 'true';

  let forceRefresh = false;
  if (wantsRefresh) {
    const now = Date.now();
    if (process.env.NODE_ENV === 'test' || now - lastForceRefreshTimestamp >= FORCE_REFRESH_COOLDOWN_MS) {
      forceRefresh = true;
      lastForceRefreshTimestamp = now;
    }
  }

  try {
    const catalog = await getFormulaCatalog(forceRefresh);
    return NextResponse.json(catalog);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to fetch formula catalog',
        message: error?.message || 'Unable to load formula catalog. You may be offline or rate-limited.',
        formulas: [],
        total: 0,
      },
      { status: 502 }
    );
  }
}
