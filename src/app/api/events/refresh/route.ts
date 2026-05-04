import { NextResponse } from 'next/server';
import { refreshAllSources } from '@/lib/ical';

export async function POST() {
  try {
    const result = await refreshAllSources();
    return NextResponse.json({ success: true, total: result.total, errors: result.errors });
  } catch (err) {
    console.error('[api/events/refresh] POST error:', err);
    return NextResponse.json({ error: 'Failed to refresh events' }, { status: 500 });
  }
}
