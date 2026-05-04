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
