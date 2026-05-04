import { NextRequest, NextResponse } from 'next/server';
import { getSourceById } from '@/lib/db';
import { refreshSourceById } from '@/lib/ical';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const result = await refreshSourceById(params.id);
    return NextResponse.json({ success: true, count: result.count });
  } catch (err) {
    console.error('[api/sources/[id]/refresh] POST error:', err);
    const message = err instanceof Error ? err.message : 'Failed to refresh source';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
