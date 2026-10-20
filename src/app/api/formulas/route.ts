import { NextResponse } from 'next/server';
import { getFormulaCatalog } from '@/lib/formula-service';

export async function GET(request?: Request) {
  const url = request ? new URL(request.url) : new URL('http://localhost:3000/api/formulas');
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    const catalog = await getFormulaCatalog(refresh);
    return NextResponse.json(catalog);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch formula catalog', message: error.message },
      { status: 500 }
    );
  }
}
