import type { CalendarEvent, Person } from '@/types';
import { getEventDateRangeKeys } from '@/lib/tz';

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Compare-slots: time-aligned concurrent event rows across all people
// ---------------------------------------------------------------------------

export type CompareSlot = {
  key: string;
  label: string;
  byPerson: Record<string, CalendarEvent[]>;
};

function tzHourMinute(dateStr: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(dateStr));
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

/**
 * Build a `Record<dateStr, CompareSlot[]>` for every date in `dateKeys`.
 *
 * Each CompareSlot represents a unique start-time that exists for at least
 * one person on that day. All person columns share the same ordered slot list
 * so concurrent events appear at the same row level.
 *
 * Called once via useMemo — not per-person, not per-render.
 */
export function buildCompareSlotsForDates(
  dateKeys: string[],
  events: CalendarEvent[],
  people: Person[],
  timezone: string,
  allDayLabel: string,
): Record<string, CompareSlot[]> {
  const personIds = new Set(people.map(p => p.id));
  const result: Record<string, CompareSlot[]> = {};

  // Pre-index events by the dates they span (timezone-aware) so we don't re-scan all events per day
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!personIds.has(event.person_id)) continue;
    const { startStr, endStr } = getEventDateRangeKeys(event, timezone);
    const cur = new Date(startStr + 'T00:00:00');
    const endD = new Date(endStr + 'T00:00:00');
    while (cur <= endD) {
      const key = localDateStr(cur);
      if (!eventsByDate.has(key)) eventsByDate.set(key, []);
      eventsByDate.get(key)!.push(event);
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const dateStr of dateKeys) {
    const dayEvents = eventsByDate.get(dateStr) ?? [];
    const timed = new Map<number, Record<string, CalendarEvent[]>>();
    const allDay: Record<string, CalendarEvent[]> = {};
    for (const p of people) allDay[p.id] = [];

    for (const event of dayEvents) {
      if (event.all_day) {
        allDay[event.person_id].push(event);
        continue;
      }
      // For multi-day timed events, show at minute 0 on continuation days
      const { startStr: evtStartStr } = getEventDateRangeKeys(event, timezone);
      const minuteOfDay = evtStartStr === dateStr ? tzHourMinute(event.start_date, timezone) : 0;

      if (!timed.has(minuteOfDay)) {
        const init: Record<string, CalendarEvent[]> = {};
        for (const p of people) init[p.id] = [];
        timed.set(minuteOfDay, init);
      }
      timed.get(minuteOfDay)![event.person_id].push(event);
    }

    const slots: CompareSlot[] = [];
    if (Object.values(allDay).some(arr => arr.length > 0)) {
      slots.push({ key: 'all-day', label: allDayLabel, byPerson: allDay });
    }
    for (const m of Array.from(timed.keys()).sort((a, b) => a - b)) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push({ key: `m-${m}`, label: `${hh}:${mm}`, byPerson: timed.get(m)! });
    }
    result[dateStr] = slots;
  }

  return result;
}

/**
 * Assigns slot indices to single-day events using actual start times so that
 * events at the same time across all person columns land on the same row.
 *
 * Algorithm:
 * 1. Collect every distinct start-time string (UTC, minute precision) across
 *    all events and sort them — each unique time becomes a base slot index.
 * 2. For each person column, assign each event the slot matching its start time.
 *    Same start time in different columns → same slot → same row level.
 * 3. If the same person has two events at the identical start time (rare), bump
 *    the second one to the next free slot.
 */
export function computeDaySingleSlots(events: CalendarEvent[]): {
  slots: Map<string, number>;
  total: number;
} {
  if (events.length === 0) return { slots: new Map(), total: 0 };

  // Build ordered mapping: start-time string → base slot index
  const uniqueTimes = Array.from(new Set(events.map(e => e.start_date.slice(0, 16)))).sort();
  const timeToBase = new Map<string, number>();
  uniqueTimes.forEach((t, i) => timeToBase.set(t, i));

  // Group by person, sort each column by start time
  const byPerson = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    if (!byPerson.has(evt.person_id)) byPerson.set(evt.person_id, []);
    byPerson.get(evt.person_id)!.push(evt);
  }
  for (const evts of Array.from(byPerson.values())) {
    evts.sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  const slots = new Map<string, number>();

  for (const personEvents of Array.from(byPerson.values())) {
    const usedSlots = new Set<number>();
    for (const evt of personEvents) {
      let slot = timeToBase.get(evt.start_date.slice(0, 16)) ?? 0;
      while (usedSlots.has(slot)) slot++;
      usedSlots.add(slot);
      slots.set(evt.id, slot);
    }
  }

  let maxSlot = 0;
  for (const s of Array.from(slots.values())) if (s > maxSlot) maxSlot = s;
  return { slots, total: maxSlot + 1 };
}

/**
 * Assigns a stable "lane" (right-side strip slot) to every multi-day event.
 *
 * Lane assignment is GLOBAL across all persons: if two people share the same
 * logical event (same ical_uid + source_id), they get the same lane number so
 * ribbons appear at identical vertical positions in every column.
 *
 * Lane 0 = rightmost strip, lane 1 = next strip in, etc.
 */
export function computeEventLanes(events: CalendarEvent[]): Map<string, number> {
  const lanes = new Map<string, number>();

  // Collect multi-day events only
  const multiDay = events.filter(e => {
    const start = e.start_date.slice(0, 10);
    const end   = (e.end_date || e.start_date).slice(0, 10);
    return start !== end;
  });

  // Group DB rows by "logical event": shared ical_uid+source_id, or solo id
  const groups = new Map<string, CalendarEvent[]>();
  for (const evt of multiDay) {
    const key = evt.ical_uid ? `${evt.source_id}:${evt.ical_uid}` : evt.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(evt);
  }

  // Build one representative per logical event for lane scheduling
  type LogicalEvent = { key: string; start: string; end: string; ids: string[] };
  const logical: LogicalEvent[] = [];
  for (const [key, evts] of Array.from(groups.entries())) {
    const start = evts.map(e => e.start_date.slice(0, 10)).sort()[0];
    const end   = evts.map(e => (e.end_date || e.start_date).slice(0, 10)).sort().reverse()[0];
    logical.push({ key, start, end, ids: evts.map(e => e.id) });
  }

  // Sort for deterministic, stable assignment
  logical.sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));

  // Greedy interval scheduling
  const laneEndDates: string[] = [];
  for (const evt of logical) {
    let lane = laneEndDates.findIndex(e => e < evt.start);
    if (lane === -1) {
      lane = laneEndDates.length;
      laneEndDates.push(evt.end);
    } else {
      laneEndDates[lane] = evt.end;
    }
    // All DB rows for this logical event share the same lane
    for (const id of evt.ids) {
      lanes.set(id, lane);
    }
  }

  return lanes;
}
