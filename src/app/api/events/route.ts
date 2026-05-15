import { NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/db';

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

function isUtcMidnight(date: Date): boolean {
  return date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
}

function isZeroMinuteSecond(date: Date): boolean {
  return date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
}

function isLikelyTimedAllDay(startDate: string, endDate?: string | null): boolean {
  if (!endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const sameDay2359 =
    start.getUTCFullYear() === end.getUTCFullYear()
    && start.getUTCMonth() === end.getUTCMonth()
    && start.getUTCDate() === end.getUTCDate()
    && isUtcMidnight(start)
    && end.getUTCHours() === 23
    && end.getUTCMinutes() === 59;
  if (sameDay2359) return true;

  const durationMs = end.getTime() - start.getTime();
  if (isUtcMidnight(start) && isUtcMidnight(end) && durationMs >= 86400000 && durationMs % 86400000 === 0) {
    return true;
  }

  if (!isZeroMinuteSecond(start) || !isZeroMinuteSecond(end)) return false;
  const min = 22 * 60 * 60 * 1000;
  const max = 26 * 60 * 60 * 1000;
  return durationMs >= min && durationMs <= max && (isUtcMidnight(start) || isUtcMidnight(end));
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
