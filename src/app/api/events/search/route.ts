import { NextRequest, NextResponse } from 'next/server';
import { searchEvents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);
  try {
    const results = searchEvents(q, 30);
    return NextResponse.json(results);
  } catch (err) {
    console.error('[api/events/search] error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
