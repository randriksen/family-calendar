import { NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/db';
import { isLikelyTimedAllDay } from '@/lib/allDay';

interface EventRow {
  id: string;
  ical_uid?: string | null;
  source_id: string;
  person_id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  all_day: number;
  location?: string | null;
  description?: string | null;
}

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

    const events = getEvents(start, end, personIds.length > 0 ? personIds : undefined) as EventRow[];
    const normalized = events.map((event) => ({
      ...event,
      all_day: event.all_day || isLikelyTimedAllDay(event.start_date, event.end_date) ? 1 : 0,
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[api/events] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
