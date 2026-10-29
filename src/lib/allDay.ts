// Heuristics for feeds that encode all-day events as timed ranges.
// Shared by /api/events and the lite mode so both agree on what is all-day.

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

export function isLikelyTimedAllDay(startDate: string, endDate?: string | null): boolean {
  if (!endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const sameDay2359 =
    start.getUTCFullYear() === end.getUTCFullYear()
    && start.getUTCMonth() === end.getUTCMonth()
    && start.getUTCDate() === end.getUTCDate()
    && isUtcMidnight(start)
    && end.getUTCHours() === 23
    && end.getUTCMinutes() === 59;
  if (sameDay2359) return true;

  const durationMs = end.getTime() - start.getTime();
  if (isUtcMidnight(start) && isUtcMidnight(end) && durationMs >= 86400000 && durationMs % 86400000 === 0) {
    return true;
  }

  if (!isZeroMinuteSecond(start) || !isZeroMinuteSecond(end)) return false;
  const min = 22 * 60 * 60 * 1000;
  const max = 26 * 60 * 60 * 1000;
  return durationMs >= min && durationMs <= max && (isUtcMidnight(start) || isUtcMidnight(end));
}
