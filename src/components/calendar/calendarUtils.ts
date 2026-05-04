import type { CalendarEvent } from '@/types';

/**
 * Computes per-column slot indices for single-day events so that shared events
 * (same title+time across multiple persons) appear at the same vertical position
 * in every person column.
 *
 * Algorithm:
 * 1. Group events per person and sort each group by start time.
 * 2. Detect "shared" event groups: same title + start minute across 2+ persons.
 * 3. For each shared group, compute the minimum slot index it can occupy =
 *    max over all participating persons of "how many events in that column start
 *    strictly before this event". This ensures every column has a spacer row
 *    above the shared event if needed.
 * 4. Assign slots per column sequentially, bumping up to the minimum for shared events.
 */
export function computeDaySingleSlots(events: CalendarEvent[]): {
  slots: Map<string, number>;
  total: number;
} {
  // Group by person and sort by start time
  const byPerson = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    if (!byPerson.has(evt.person_id)) byPerson.set(evt.person_id, []);
    byPerson.get(evt.person_id)!.push(evt);
  }
  for (const evts of Array.from(byPerson.values())) {
    evts.sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  // Group key: ical_uid (shared across calendars) or title+startMinute fallback
  const getGroupKey = (e: CalendarEvent): string =>
    e.ical_uid ? `uid:${e.ical_uid}` : `tt:${e.title}|${e.start_date.slice(0, 16)}`;

  // Collect persons per group key and earliest start_date
  const keyToPersons = new Map<string, Set<string>>();
  const keyToStart  = new Map<string, string>();
  for (const evt of events) {
    const key = getGroupKey(evt);
    if (!keyToPersons.has(key)) keyToPersons.set(key, new Set());
    keyToPersons.get(key)!.add(evt.person_id);
    if (!keyToStart.has(key) || evt.start_date < keyToStart.get(key)!) {
      keyToStart.set(key, evt.start_date.slice(0, 16));
    }
  }

  // Shared = same key appears in 2+ different persons
  const sharedKeys = new Set<string>();
  for (const [key, persons] of Array.from(keyToPersons.entries())) {
    if (persons.size > 1) sharedKeys.add(key);
  }

  // For each shared group, minimum slot = max(events in any participating column
  // that start strictly before this event's start minute)
  const sharedMinSlot = new Map<string, number>();
  for (const key of Array.from(sharedKeys)) {
    const startMin = keyToStart.get(key)!;
    const persons  = keyToPersons.get(key)!;
    let min = 0;
    for (const pid of Array.from(persons)) {
      const before = (byPerson.get(pid) ?? []).filter(
        e => e.start_date.slice(0, 16) < startMin
      ).length;
      if (before > min) min = before;
    }
    sharedMinSlot.set(key, min);
  }

  // Assign slots column-by-column
  const slots = new Map<string, number>();
  let maxSlot = 0;
  for (const personEvents of Array.from(byPerson.values())) {
    let cur = 0;
    for (const evt of personEvents) {
      const key = getGroupKey(evt);
      if (sharedKeys.has(key)) {
        const min = sharedMinSlot.get(key) ?? 0;
        if (min > cur) cur = min;
      }
      slots.set(evt.id, cur);
      if (cur > maxSlot) maxSlot = cur;
      cur++;
    }
  }

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
