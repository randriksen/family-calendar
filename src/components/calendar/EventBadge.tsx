'use client';

import type { CalendarEvent, CalendarSource, Person } from '@/types';
import { formatTzTime } from '@/lib/tz';

export type EventPosition = 'single' | 'first' | 'middle' | 'last';

interface EventBadgeProps {
  event: CalendarEvent;
  sources: CalendarSource[];
  people: Person[];
  timezone: string;
  compact?: boolean;
  hideLocation?: boolean;
  position?: EventPosition;
  onClick?: (event: CalendarEvent) => void;
}

// Colour logic lives in @/lib/eventColor so server code can share it.
import { getEventColor, getTextColor } from '@/lib/eventColor';
export { getEventColor, getSourceColor, getTextColor } from '@/lib/eventColor';

export default function EventBadge({ event, sources, people, timezone, compact = false, hideLocation = false, position = 'single', onClick }: EventBadgeProps) {
  const color = getEventColor(event, sources, people);
  const textColor = getTextColor(color);
  const isSingleAllDay = position === 'single' && event.all_day === 1;

  if (compact) {
    return (
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 cursor-pointer"
        style={{ backgroundColor: color }}
        title={event.title}
        onClick={() => onClick?.(event)}
      />
    );
  }

  // Continuation bar: middle or last day of a multi-day event
  // Rendered flush (no padding) by DayCell — just a solid color strip
  if (position === 'middle') {
    return (
      <div
        className="w-full h-5"
        style={{ backgroundColor: color }}
        title={event.title}
      />
    );
  }

  if (position === 'last') {
    return (
      <div
        className="w-full h-5 rounded-b"
        style={{ backgroundColor: color }}
        title={event.title}
      />
    );
  }

  // First day of multi-day event OR single-day event
  const isTimed = !event.all_day;
  const startTimeStr = isTimed ? formatTzTime(event.start_date, timezone) : '';
  const endTimeStr = isTimed && position === 'single' && event.end_date
    ? formatTzTime(event.end_date, timezone)
    : '';
  const timeStr = startTimeStr && endTimeStr && endTimeStr !== startTimeStr
    ? `${startTimeStr} – ${endTimeStr}`
    : startTimeStr;

  // 'first': flat bottom so the continuation bar below connects flush
  // 'single': fully rounded
  const roundedClass = position === 'first' ? 'rounded-t' : 'rounded';

  return (
    <div
      className={`flex flex-col px-1.5 py-0.5 2xl:px-2 2xl:py-1 ${roundedClass} text-xs 2xl:text-sm w-full cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${isSingleAllDay ? 'font-semibold shadow-sm' : 'font-medium'}`}
      style={{
        backgroundColor: color,
        color: textColor,
        border: isSingleAllDay ? '1px solid rgba(255,255,255,0.45)' : 'none',
      }}
      title={[event.title, timeStr, event.location].filter(Boolean).join(' · ')}
      onClick={() => onClick?.(event)}
      onContextMenu={e => { e.preventDefault(); onClick?.(event); }}
    >
      <div className="flex items-center gap-1 overflow-hidden">
        {isSingleAllDay && (
          <span className="flex-shrink-0 uppercase tracking-wide text-[9px] font-bold opacity-90">All day</span>
        )}
        {timeStr && <span className="flex-shrink-0 opacity-80 font-normal">{timeStr}</span>}
        <span className="truncate">{event.title}</span>
      </div>
      {event.location && !hideLocation && (
        <div className="truncate opacity-75 font-normal text-[0.65rem] 2xl:text-xs">
          📍 {event.location}
        </div>
      )}
    </div>
  );
}
