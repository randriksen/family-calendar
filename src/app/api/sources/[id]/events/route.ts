import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, getEventsBySource } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const rows = getEventsBySource(params.id);
    const events = rows.map(e => ({
      ...e,
      person_ids: e.person_ids ? e.person_ids.split(',') : [],
    }));

    return NextResponse.json(events);
  } catch (err) {
    console.error('[api/sources/[id]/events] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
