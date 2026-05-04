'use client';

import { format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person } from '@/types';

export type EventPosition = 'single' | 'first' | 'middle' | 'last';

interface EventBadgeProps {
  event: CalendarEvent;
  sources: CalendarSource[];
  people: Person[];
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

export function getEventColor(
  event: CalendarEvent,
  sources: CalendarSource[],
  people: Person[]
): string {
  const source = sources.find(s => s.id === event.source_id);
  if (source?.color) return source.color;
  const person = people.find(p => p.id === event.person_id);
  return person?.color || '#6b7280';
}

function fmt(dateStr: string): string {
  try { return format(new Date(dateStr), 'HH:mm'); } catch { return ''; }
}

export default function EventBadge({ event, sources, people, compact = false, hideLocation = false, position = 'single', onClick }: EventBadgeProps) {
  const color = getEventColor(event, sources, people);
  const textColor = getTextColor(color);

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
  const startTime = !event.all_day ? fmt(event.start_date) : '';
  const endTime = !event.all_day && event.end_date ? fmt(event.end_date) : '';
  const timeStr = startTime && endTime && endTime !== startTime
    ? `${startTime}–${endTime}`
    : startTime;

  // 'first': flat bottom so the continuation bar below connects flush
  // 'single': fully rounded
  const roundedClass = position === 'first' ? 'rounded-t' : 'rounded';

  return (
    <div
      className={`flex flex-col px-1.5 py-0.5 ${roundedClass} text-xs font-medium w-full cursor-pointer hover:opacity-90 transition-opacity overflow-hidden`}
      style={{ backgroundColor: color, color: textColor }}
      title={[event.title, timeStr, event.location].filter(Boolean).join(' · ')}
      onClick={() => onClick?.(event)}
      onContextMenu={e => { e.preventDefault(); onClick?.(event); }}
    >
      <div className="flex items-center gap-1 overflow-hidden">
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
