import * as ical from 'node-ical';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { addYears } from 'date-fns';
import {
  getDb,
  deleteEventsBySource,
  insertEvents,
  updateSource,
  getSources,
  getSourceById,
  getSourcePeople,
  UPLOADS_PATH,
} from './db';
import type { CalendarSource } from '@/types';

interface ParsedEvent {
  id: string;
  ical_uid: string;
  source_id: string;
  person_id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  all_day: number;
  location: string | null;
  description: string | null;
}

function toISOString(date: Date): string {
  return date.toISOString();
}

function isAllDay(date: ical.DateWithTimeZone | Date): boolean {
  return (date as unknown as { dateOnly?: boolean }).dateOnly === true;
}

function parseEvents(
  data: ical.CalendarResponse,
  sourceId: string,
  personIds: string[],
): ParsedEvent[] {
  const results: ParsedEvent[] = [];
  const windowStart = new Date();
  const windowEnd = addYears(new Date(), 2);

  for (const [, component] of Object.entries(data)) {
    if (component.type !== 'VEVENT') continue;
    const event = component as ical.VEvent;
    if (!event.start) continue;

    const icalUid = ((event.uid as string | undefined) || uuidv4()).trim();
    const title = event.summary || 'Untitled';
    const location = event.location || null;
    const description = typeof event.description === 'string' ? event.description : null;

    if (event.rrule) {
      try {
        const occurrences = event.rrule.between(windowStart, windowEnd, true);
        for (const occurrence of occurrences) {
          const duration = event.end && event.start
            ? event.end.getTime() - event.start.getTime()
            : 0;
          const occurrenceEnd = duration > 0 ? new Date(occurrence.getTime() + duration) : null;
          const allDay = isAllDay(event.start);

          for (const personId of personIds) {
            results.push({
              id: uuidv4(),
              ical_uid: icalUid,
              source_id: sourceId,
              person_id: personId,
              title,
              start_date: toISOString(occurrence),
              end_date: occurrenceEnd ? toISOString(occurrenceEnd) : null,
              all_day: allDay ? 1 : 0,
              location,
              description,
            });
          }
        }
      } catch (e) {
        console.error('[ical] Failed to expand recurring event:', e);
      }
      continue;
    }

    const start = event.start;
    const end = event.end || null;
    const allDay = isAllDay(start);

    let endDate: string | null = null;
    if (end) {
      if (allDay) {
        endDate = toISOString(new Date(end.getTime() - 1));
      } else {
        endDate = toISOString(end);
      }
    }

    for (const personId of personIds) {
      results.push({
        id: uuidv4(),
        ical_uid: icalUid,
        source_id: sourceId,
        person_id: personId,
        title,
        start_date: toISOString(start),
        end_date: endDate,
        all_day: allDay ? 1 : 0,
        location,
        description,
      });
    }
  }

  return results;
}

export async function refreshSource(source: CalendarSource): Promise<{ count: number }> {
  let icalData: ical.CalendarResponse;

  try {
    if (source.type === 'ical_url') {
      if (!source.url) throw new Error('No URL provided for ical_url source');
      icalData = await ical.async.fromURL(source.url);
    } else if (source.type === 'ical_file') {
      if (!source.file_path) throw new Error('No file path provided for ical_file source');
      const fullPath = path.isAbsolute(source.file_path)
        ? source.file_path
        : path.join(UPLOADS_PATH, source.file_path);
      if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
      icalData = await ical.async.parseFile(fullPath);
    } else {
      throw new Error(`Unknown source type: ${source.type}`);
    }
  } catch (err) {
    console.error(`[ical] Failed to fetch/parse source ${source.id} (${source.name}):`, err);
    throw err;
  }

  // Resolve which people get events from this source
  const sourcePeople = getSourcePeople(source.id);
  const personIds = sourcePeople.length > 0
    ? sourcePeople
    : source.person_id ? [source.person_id] : [];

  if (personIds.length === 0) {
    console.warn(`[ical] Source "${source.name}" has no people assigned, skipping events`);
    deleteEventsBySource(source.id);
    updateSource(source.id, { last_fetched_at: new Date().toISOString() });
    return { count: 0 };
  }

  const events = parseEvents(icalData, source.id, personIds);

  deleteEventsBySource(source.id);
  if (events.length > 0) insertEvents(events);
  updateSource(source.id, { last_fetched_at: new Date().toISOString() });

  console.log(`[ical] Refreshed source "${source.name}": ${events.length} events`);
  return { count: events.length };
}

export async function refreshAllSources(): Promise<{ total: number; errors: number }> {
  const sources = getSources() as CalendarSource[];
  let total = 0;
  let errors = 0;
  for (const source of sources) {
    try {
      const result = await refreshSource(source);
      total += result.count;
    } catch {
      errors++;
    }
  }
  return { total, errors };
}

export async function refreshSourceById(sourceId: string): Promise<{ count: number }> {
  const source = getSourceById(sourceId) as CalendarSource | null;
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  return refreshSource(source);
}
