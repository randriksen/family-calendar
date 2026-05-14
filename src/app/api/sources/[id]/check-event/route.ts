import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, getDb } from '@/lib/db';
import { refreshSourceById } from '@/lib/ical';

// POST /api/sources/[id]/check-event
// Body: { ical_uid: string }
// Fetches the source's iCal, checks whether the given ical_uid still exists.
// If it doesn't, removes all event rows for that (source_id, ical_uid) and returns { exists: false, removed: true }.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const body = await request.json();
    const icalUid: string | undefined = body.ical_uid;
    if (!icalUid) return NextResponse.json({ error: 'ical_uid is required' }, { status: 400 });

    // Re-sync the source so we have a fresh event list, then check the DB.
    // refreshSourceById already does delete-then-reinsert, so after it runs:
    //   - if the event still exists in the feed  → it will be in the DB
    //   - if it was deleted from the feed        → it will NOT be in the DB
    await refreshSourceById(params.id);

    const db = getDb();
    const row = db.prepare(
      'SELECT 1 FROM events WHERE source_id = ? AND ical_uid = ? LIMIT 1'
    ).get(params.id, icalUid);

    const exists = !!row;

    return NextResponse.json({ exists, removed: !exists });
  } catch (err) {
    console.error('[api/sources/[id]/check-event] POST error:', err);
    const message = err instanceof Error ? err.message : 'Check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
