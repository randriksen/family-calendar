import type { CalendarEvent } from '@/types';

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
