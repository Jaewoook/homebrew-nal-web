import { NextResponse } from 'next/server';
import { getFormulaCatalog } from '@/lib/formula-service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    const catalog = await getFormulaCatalog(refresh);
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
