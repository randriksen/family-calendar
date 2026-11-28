import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { addDays, parseISO } from 'date-fns';
import { getEvents, getPeople, getSettings, getSources } from '@/lib/db';
import { isLikelyTimedAllDay } from '@/lib/allDay';
import { buildFrameModel, frameText, FRAME_H, FRAME_W } from '@/lib/frame';
import { normalizeAllDayEndIsoForDisplay, toTzDateStr } from '@/lib/tz';
import FrameImage from '@/components/frame/FrameImage';
import type { CalendarEvent, CalendarSource, Person } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /frame.png?days=<1-14>&layout=vertical|horizontal&date=YYYY-MM-DD
//
// The coming days as a 3840x2160 PNG, by default one row per day running
// down the picture and one column per person; layout=horizontal turns it
// round, one row per person and one column per day. Meant to be fetched on a timer and uploaded to a TV that shows
// pictures rather than web pages (Samsung The Frame's Art Mode); see the
// README. `date` pins the first day and exists for testing; by default the
// picture starts today.

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([['Regular', 400], ['Bold', 700]] as const).map(async ([file, weight]) => ({
      name: 'Noto Sans',
      data: await readFile(path.join(process.cwd(), 'public', 'fonts', `NotoSans-${file}.ttf`)),
      weight,
      style: 'normal' as const,
    })),
  ).catch(err => { fonts = null; throw err; });
  return fonts;
}

export async function GET(request: NextRequest) {
  const settings = getSettings();
  const timezone = settings.display_timezone || 'Europe/Oslo';
  const query = new URL(request.url).searchParams;

  const now = new Date();
  const todayKey = toTzDateStr(now, timezone);
  const dateParam = query.get('date') || '';
  const startKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(parseISO(dateParam).getTime()) ? dateParam : todayKey;
  const daysParam = parseInt(query.get('days') || '', 10);
  const dayCount = Number.isFinite(daysParam) ? Math.min(14, Math.max(1, daysParam)) : 7;

  // A day either side so timezone shifts at the edges don't drop events.
  const first = parseISO(startKey);
  const raw = getEvents(addDays(first, -1).toISOString(), addDays(first, dayCount + 1).toISOString()) as CalendarEvent[];
  const events: CalendarEvent[] = raw.map(ev => {
    const allDay = ev.all_day || isLikelyTimedAllDay(ev.start_date, ev.end_date) ? 1 : 0;
    const endDate = allDay && ev.end_date ? normalizeAllDayEndIsoForDisplay(ev.start_date, ev.end_date) : ev.end_date;
    return { ...ev, all_day: allDay, end_date: endDate };
  });

  const people = (getPeople() as Person[]).map(p => ({ ...p, name: frameText(p.name) }));
  const model = buildFrameModel({
    startKey, dayCount, todayKey, now, events, people,
    sources: getSources() as CalendarSource[],
    settings,
    layout: query.get('layout') === 'horizontal' ? 'horizontal' : 'vertical',
  });

  // ImageResponse insists on a year-long immutable Cache-Control, which would
  // freeze the calendar in any cache on the way; re-wrap the bytes instead.
  const image = new ImageResponse(<FrameImage m={model} />, {
    width: FRAME_W,
    height: FRAME_H,
    fonts: await loadFonts(),
  });
  return new Response(await image.arrayBuffer(), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
