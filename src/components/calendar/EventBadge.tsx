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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

export function getTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#000';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#1f2937' : '#ffffff';
}

// Derive a pleasant, deterministic hex color from an arbitrary string.
// Used so shared-source events always render the same color regardless of person.
function hashToHex(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  const hue = hash % 360;
  const s = 0.55, l = 0.45;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toRgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const h = hue / 360;
  const r = Math.round(toRgb(h + 1 / 3) * 255);
  const g = Math.round(toRgb(h) * 255);
  const b = Math.round(toRgb(h - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getEventColor(
  event: CalendarEvent,
  sources: CalendarSource[],
  people: Person[]
): string {
  const source = sources.find(s => s.id === event.source_id);
  if (source?.color) return source.color;
  // Shared source (multiple people) with no explicit color → deterministic source color
  // so the same event looks identical in every person's column
  if (source && source.person_ids && source.person_ids.length > 1) {
    return hashToHex(source.id);
  }
  const person = people.find(p => p.id === event.person_id);
  return person?.color || '#6b7280';
}

export default function EventBadge({ event, sources, people, timezone, compact = false, hideLocation = false, position = 'single', onClick }: EventBadgeProps) {
  const color = getEventColor(event, sources, people);
  const textColor = getTextColor(color);
  const isSingleAllDay = position === 'single' && !!event.all_day;

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
  const timeStr = !event.all_day ? formatTzTime(event.start_date, timezone) : '';

  // 'first': flat bottom so the continuation bar below connects flush
  // 'single': fully rounded
  const roundedClass = position === 'first' ? 'rounded-t' : 'rounded';

  return (
    <div
      className={`flex flex-col px-1.5 py-0.5 ${roundedClass} text-xs w-full cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${isSingleAllDay ? 'font-semibold shadow-sm' : 'font-medium'}`}
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
        <div className="truncate opacity-75 font-normal" style={{ fontSize: '0.65rem' }}>
          📍 {event.location}
        </div>
      )}
    </div>
  );
}
