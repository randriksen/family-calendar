import { NextRequest } from 'next/server';
import { createElement } from 'react';
import { renderStatic } from '@/lib/staticHtml';
import { addDays } from 'date-fns';
import { getEvents, getPeople, getSettings, getSources } from '@/lib/db';
import { buildLiteModel, liteDateSpan, parseLiteParams } from '@/lib/lite';
import { isLikelyTimedAllDay } from '@/lib/allDay';
import { normalizeAllDayEndIsoForDisplay, toTzDateStr } from '@/lib/tz';
import LitePage from '@/components/lite/LitePage';
import type { CalendarEvent, CalendarSource, Person } from '@/types';

export const dynamic = 'force-dynamic';

// GET /lite?view=month|week|day&date=YYYY-MM-DD&person=<id>&refresh=<seconds>
//
// A deliberately plain HTML calendar for old or weak devices: one period at a
// time, navigation by ordinary links, periodic reload via <meta refresh>, and
// no client-side JavaScript at all. Served as a route handler rather than a
// page so none of the Next/React runtime is sent to the browser.
export async function GET(request: NextRequest) {
  const settings = getSettings();
  const people = getPeople() as Person[];
  const sources = getSources() as CalendarSource[];
  const timezone = settings.display_timezone || 'Europe/Oslo';

  const params = parseLiteParams(new URL(request.url).searchParams, {
    todayKey: toTzDateStr(new Date(), timezone),
    defaultView: settings.default_view || 'month',
    peopleIds: people.map(p => p.id),
  });

  // Fetch a day either side of the visible span so timezone shifts at the
  // edges don't drop events.
  const span = liteDateSpan(params.view, params.dateKey);
  const start = addDays(span.start, -1).toISOString();
  const end = addDays(span.end, 2).toISOString();

  const raw = getEvents(start, end, params.personId ? [params.personId] : undefined) as CalendarEvent[];
  const events: CalendarEvent[] = raw.map(ev => {
    const allDay = ev.all_day || isLikelyTimedAllDay(ev.start_date, ev.end_date) ? 1 : 0;
    const endDate = allDay && ev.end_date ? normalizeAllDayEndIsoForDisplay(ev.start_date, ev.end_date) : ev.end_date;
    return { ...ev, all_day: allDay, end_date: endDate };
  });

  const model = buildLiteModel({ params, events, people, sources, settings });
  const html = '<!DOCTYPE html>' + renderStatic(createElement(LitePage, { m: model }));

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
