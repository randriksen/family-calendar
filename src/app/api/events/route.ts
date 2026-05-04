import { NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const personIds = searchParams.getAll('person_id');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end date parameters are required' }, { status: 400 });
    }

    // Validate ISO dates
    if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
      return NextResponse.json({ error: 'Invalid date format. Use ISO 8601.' }, { status: 400 });
    }

    const events = getEvents(start, end, personIds.length > 0 ? personIds : undefined);
    return NextResponse.json(events);
  } catch (err) {
    console.error('[api/events] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
