import type { CalendarEvent } from '@/types';

/**
 * Assigns a stable "lane" (horizontal offset slot) to every multi-day event
 * so its right-side strip never jumps position as other events start/end.
 *
 * Lane 0 = rightmost strip, lane 1 = next strip in, etc.
 * Events are grouped per person so columns don't interfere with each other.
 */
export function computeEventLanes(events: CalendarEvent[]): Map<string, number> {
  const lanes = new Map<string, number>();

  // Group multi-day events per person
  const byPerson = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    const start = evt.start_date.slice(0, 10);
    const end   = (evt.end_date || evt.start_date).slice(0, 10);
    if (start === end) continue; // single-day – no strip needed
    if (!byPerson.has(evt.person_id)) byPerson.set(evt.person_id, []);
    byPerson.get(evt.person_id)!.push(evt);
  }

  for (const personEvents of Array.from(byPerson.values())) {
    // Sort by start date then by id for a deterministic order
    personEvents.sort((a, b) => {
      const d = a.start_date.localeCompare(b.start_date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

    // Greedy interval-scheduling: assign the smallest free lane
    const laneEndDates: string[] = []; // laneIndex → last occupied end date
    for (const evt of personEvents) {
      const start = evt.start_date.slice(0, 10);
      const end   = (evt.end_date || evt.start_date).slice(0, 10);

      let lane = laneEndDates.findIndex(e => e < start);
      if (lane === -1) {
        lane = laneEndDates.length;
        laneEndDates.push(end);
      } else {
        laneEndDates[lane] = end;
      }
      lanes.set(evt.id, lane);
    }
  }

  return lanes;
}
