import type { CalendarEvent, Person } from '@/types';
import { getEventDateRangeKeys } from '@/lib/tz';

// Pure helpers for the schedule (timeplan) view: minute-of-day maths, overlap
// lanes and per-day span buckets. Shared by the interactive ScheduleView and
// the server-rendered lite page, so nothing here may touch React or the DOM.

export function tzMinutes(isoStr: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoStr));
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0) * 60
       + Number(parts.find(p => p.type === 'minute')?.value ?? 0);
}

export interface Interval { start: number; end: number; }

export function mergeIntervals(ivs: Interval[]): Interval[] {
  if (!ivs.length) return [];
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (const iv of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

export interface Span { event: CalendarEvent; startMin: number; endMin: number; }
export interface PosSpan extends Span { lane: number; totalLanes: number; }

export function assignLanes(spans: Span[]): PosSpan[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];
  const withLane = sorted.map(item => {
    let lane = laneEnds.findIndex(e => e <= item.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.endMin); }
    else laneEnds[lane] = item.endMin;
    return { ...item, lane };
  });
  return withLane.map(item => {
    let max = item.lane;
    for (const o of withLane)
      if (o.startMin < item.endMin && o.endMin > item.startMin) max = Math.max(max, o.lane);
    return { ...item, totalLanes: max + 1 };
  });
}

export interface DayData {
  dayKey       : string;
  spansByPerson: Map<string, Span[]>;
  allMin       : number;
  allMax       : number;
  hasEvents    : boolean;
}

// Timed events for one day (YYYY-MM-DD in the display timezone), bucketed per
// person. All-day events don't belong on a time axis and are skipped.
export function buildDayData(dayKey: string, events: CalendarEvent[], people: Person[], tz: string): DayData {
  const spansByPerson = new Map<string, Span[]>(people.map(p => [p.id, []]));
  let allMin = Infinity, allMax = -Infinity;

  for (const ev of events) {
    if (ev.all_day || !ev.person_id || !spansByPerson.has(ev.person_id)) continue;
    const { startStr, endStr } = getEventDateRangeKeys(ev, tz);
    if (dayKey < startStr || dayKey > endStr) continue;
    const startMin = startStr === dayKey ? tzMinutes(ev.start_date, tz) : 0;
    const rawEnd   = endStr === dayKey && ev.end_date ? tzMinutes(ev.end_date, tz) : 24 * 60;
    const endMin   = Math.max(startMin + 15, rawEnd);
    spansByPerson.get(ev.person_id)!.push({ event: ev, startMin, endMin });
    if (startMin < allMin) allMin = startMin;
    if (endMin   > allMax) allMax = endMin;
  }

  const hasEvents = allMin !== Infinity;
  if (!hasEvents) { allMin = 8 * 60; allMax = 18 * 60; }
  return { dayKey, spansByPerson, allMin, allMax, hasEvents };
}

export function cleanDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')          // strip HTML tags
    .replace(/https?:\/\/\S+/g, '')    // remove URLs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function fmtGap(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
