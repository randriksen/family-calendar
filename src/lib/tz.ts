// Timezone-aware date helpers using Intl — no extra dependency needed.
// All functions accept UTC date strings (as stored in the DB) and an IANA timezone.

// Get a YYYY-MM-DD string for a UTC date in the given IANA timezone
export function toTzDateStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// Format time as HH:mm in the given IANA timezone
export function formatTzTime(dateStr: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(dateStr));
  } catch { return ''; }
}

// Format as dd.MM.yyyy or dd.MM.yyyy HH:mm in the given IANA timezone
export function formatTzDateTime(dateStr: string, tz: string, allDay: boolean): string {
  try {
    const d = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
    }).formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    if (allDay) return `${get('day')}.${get('month')}.${get('year')}`;
    return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
  } catch { return dateStr; }
}

// Some feeds encode all-day events with an exclusive midnight end on the next day.
// Normalize those to the previous day for display bucketing.
export function normalizeAllDayEndIsoForDisplay(startDateStr: string, endDateStr: string): string {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return endDateStr;

    // Already an inclusive all-day end marker.
    if (
      end.getUTCHours() === 23
      && end.getUTCMinutes() === 59
      && end.getUTCSeconds() === 0
      && end.getUTCMilliseconds() === 0
    ) {
      return endDateStr;
    }

    // Legacy rows can encode all-day with an exclusive hour boundary end
    // (00:00, 02:00, 22:00, ...), also for multi-day spans.
    // Treat any hour-aligned end later than start as exclusive.
    const hourAlignedExclusive =
      end.getTime() > start.getTime()
      && end.getUTCMinutes() === 0
      && end.getUTCSeconds() === 0
      && end.getUTCMilliseconds() === 0;

    if (hourAlignedExclusive) {
      return new Date(end.getTime() - 60000).toISOString();
    }

    // Also handle canonical exclusive midnight end.
    if (
      end.getUTCHours() === 0
      && end.getUTCMinutes() === 0
      && end.getUTCSeconds() === 0
      && end.getUTCMilliseconds() === 0
    ) {
      return new Date(end.getTime() - 60000).toISOString();
    }
    return endDateStr;
  } catch {
    return endDateStr;
  }
}

export function getEventDateRangeKeys(
  event: { start_date: string; end_date?: string | null; all_day: number },
  tz: string,
): { startStr: string; endStr: string } {
  if (!event.all_day) {
    const startStr = toTzDateStr(new Date(event.start_date), tz);
    const endStr = toTzDateStr(new Date(event.end_date || event.start_date), tz);
    return { startStr, endStr };
  }
  // For all-day events use the UTC date portion directly (.slice(0,10)).
  // This works for both legacy rows (T23:59:59.999Z end) and new rows
  // (T00:00:00.000Z end) without any timezone conversion.
  const startStr = event.start_date.slice(0, 10);
  const endStr = (event.end_date || event.start_date).slice(0, 10);
  return { startStr, endStr };
}
