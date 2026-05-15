import * as ical from 'node-ical';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
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

// Some providers encode all-day events as timed UTC midnight-to-midnight ranges.
// Treat those as all-day to avoid timezone-shifted display times like 02:00.
function isTimedMidnightAllDay(start: Date, end: Date | null): boolean {
  if (!end) return false;
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return false;

  // Exact midnight-aligned full-day ranges.
  if (isUtcMidnight(start) && isUtcMidnight(end)) {
    return durationMs >= 86400000 && durationMs % 86400000 === 0;
  }

  // Near full-day timed ranges (22-26h) frequently represent all-day events
  // that were converted through timezone offsets.
  if (!isZeroMinuteSecond(start) || !isZeroMinuteSecond(end)) return false;
  const min = 22 * 60 * 60 * 1000;
  const max = 26 * 60 * 60 * 1000;
  return durationMs >= min && durationMs <= max && (isUtcMidnight(start) || isUtcMidnight(end));
}

// For all-day events: return a YYYY-MM-DDT00:00:00.000Z string for the given calendar date.
// node-ical creates VALUE=DATE events as new Date(y, m, d) = LOCAL midnight, so use local
// time methods here so the date string matches the calendar date on any server timezone.
function allDayStartStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// For all-day events: DTEND is exclusive (day after last day), so subtract one local day.
// Store as YYYY-MM-DDT00:00:00.000Z of the inclusive last day so .slice(0,10) is correct.
function allDayEndStr(exclusiveEnd: Date): string {
  const lastDay = new Date(
    exclusiveEnd.getFullYear(),
    exclusiveEnd.getMonth(),
    exclusiveEnd.getDate() - 1,
  );
  const y = lastDay.getFullYear();
  const m = String(lastDay.getMonth() + 1).padStart(2, '0');
  const d = String(lastDay.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// Returns the UTC offset of tzid at the given UTC instant, in milliseconds.
// Positive means ahead of UTC (e.g. Europe/Berlin in CEST = +7_200_000).
function tzOffsetMs(tzid: string, utcDate: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tzid,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);
  const g = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - utcDate.getTime();
}

// Convert a wall-clock time in tzid to a UTC Date.
// Two iterations handles DST-boundary edge cases.
function wallClockInTzToUtc(y: number, mo: number, d: number, h: number, m: number, s: number, tzid: string): Date {
  const nominal = Date.UTC(y, mo, d, h, m, s);
  const off1 = tzOffsetMs(tzid, new Date(nominal));
  const est = new Date(nominal - off1);
  const off2 = tzOffsetMs(tzid, est);
  return new Date(nominal - off2);
}

// rrule.between() generates occurrences using the server's local timezone hour from
// dtstart instead of the event's TZID wall-clock hour. Fix each occurrence by
// substituting the correct wall-clock time (from dtstart in tzid) while keeping
// the calendar date rrule computed.
function fixRruleOccurrence(occurrence: Date, dtstart: Date, tzid: string): Date {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tzid, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(dtstart);
  const g = (t: string) => parseInt(p.find(x => x.type === t)!.value, 10);
  return wallClockInTzToUtc(
    occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate(),
    g('hour') % 24, g('minute'), g('second'),
    tzid,
  );
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

    // Generate a stable UID from content so overrides survive re-syncs.
    // Some calendar providers (e.g. Hoopit) append a download timestamp to every
    // UID, making each fetch produce different UIDs and breaking override matching.
    // Using source + title + series-start gives a deterministic, stable key:
    //   - recurring events: event.start is the DTSTART of the whole series, so
    //     every expanded occurrence shares the same stable UID (correct — overrides
    //     should apply to the whole series).
    //   - non-recurring events: event.start is the actual date, unique per event.
    const rawUid = ((event.uid as string | undefined) || '').trim();
    const icalUid = createHash('sha1')
      .update(`${sourceId}\0${event.summary ?? rawUid}\0${event.start.toISOString()}`)
      .digest('hex');
    const title = event.summary || 'Untitled';
    const location = event.location || null;
    const description = typeof event.description === 'string' ? event.description : null;

    if (event.rrule) {
      try {
        const isDateOnlyAllDay = isAllDay(event.start);
        const isTimedAllDay = !isDateOnlyAllDay && isTimedMidnightAllDay(event.start, event.end || null);
        const allDay = isDateOnlyAllDay || isTimedAllDay;
        const tzid = !allDay ? (event.start as ical.DateWithTimeZone).tz : undefined;
        const needsTzFix = !!tzid && tzid !== 'UTC' && tzid !== 'Etc/UTC';
        const allDaySpanDays = allDay
          ? (() => {
              if (!event.end) return 1;
              if (isDateOnlyAllDay) {
                // node-ical VALUE=DATE → local midnight; use local methods for correct day count
                const startLocalDay = Date.UTC(
                  event.start.getFullYear(),
                  event.start.getMonth(),
                  event.start.getDate(),
                );
                const endLocalDay = Date.UTC(
                  event.end.getFullYear(),
                  event.end.getMonth(),
                  event.end.getDate(),
                );
                // DATE DTEND is exclusive. 1 means single-day all-day event.
                return Math.max(Math.round((endLocalDay - startLocalDay) / 86400000), 1);
              }
              const durationMs = event.end.getTime() - event.start.getTime();
              return Math.max(Math.round(durationMs / 86400000), 1);
            })()
          : 0;

        const occurrences = event.rrule.between(windowStart, windowEnd, true);
        for (const occurrence of occurrences) {
          let start = occurrence;
          if (needsTzFix) {
            try {
              start = fixRruleOccurrence(occurrence, event.start, tzid!);
            } catch {
              // TZID not recognized by Intl — keep rrule-generated time
            }
          }
          const duration = event.end && event.start
            ? event.end.getTime() - event.start.getTime()
            : 0;
          const occurrenceEnd = duration > 0 ? new Date(start.getTime() + duration) : null;
          const allDayStart = allDay ? allDayStartStr(start) : null;
          const allDayEnd = allDay
            ? allDayEndStr(new Date(Date.UTC(
                start.getUTCFullYear(),
                start.getUTCMonth(),
                start.getUTCDate() + allDaySpanDays,
              )))
            : null;

          for (const personId of personIds) {
            results.push({
              id: uuidv4(),
              ical_uid: icalUid,
              source_id: sourceId,
              person_id: personId,
              title,
              start_date: allDayStart ?? toISOString(start),
              end_date: allDayEnd ?? (occurrenceEnd ? toISOString(occurrenceEnd) : null),
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
    const isDateOnlyAllDay = isAllDay(start);
    const isTimedAllDay = !isDateOnlyAllDay && isTimedMidnightAllDay(start, end);
    const allDay = isDateOnlyAllDay || isTimedAllDay;

    const startDate = allDay ? allDayStartStr(start) : toISOString(start);
    const endDate: string | null = allDay
      ? allDayEndStr(end ?? new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + 1,
        ))
      : (end ? toISOString(end) : null);

    for (const personId of personIds) {
      results.push({
        id: uuidv4(),
        ical_uid: icalUid,
        source_id: sourceId,
        person_id: personId,
        title,
        start_date: startDate,
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

export async function refreshDueSources(): Promise<{ total: number; errors: number; skipped: number }> {
  const sources = getSources() as CalendarSource[];
  const now = Date.now();
  let total = 0;
  let errors = 0;
  let skipped = 0;
  for (const source of sources) {
    const intervalMs = (source.sync_interval_minutes ?? 240) * 60 * 1000;
    const lastFetched = source.last_fetched_at ? new Date(source.last_fetched_at).getTime() : 0;
    if (lastFetched > 0 && now - lastFetched < intervalMs) {
      skipped++;
      continue;
    }
    try {
      const result = await refreshSource(source);
      total += result.count;
    } catch {
      errors++;
    }
  }
  return { total, errors, skipped };
}

export async function refreshSourceById(sourceId: string): Promise<{ count: number }> {
  const source = getSourceById(sourceId) as CalendarSource | null;
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  return refreshSource(source);
}
