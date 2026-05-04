'use client';

import type { CalendarEvent, CalendarSource, Person } from '@/types';
import EventBadge, { getEventColor, type EventPosition } from './EventBadge';

export interface EventDisplay {
  event: CalendarEvent;
  position: EventPosition;
}

interface DayCellProps {
  eventDisplays: EventDisplay[];
  sources: CalendarSource[];
  people: Person[];
  isToday: boolean;
  isCurrentMonth?: boolean;
  maxEvents?: number;
  hideLocation?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  eventLanes?: Map<string, number>;
}

const STRIP_W = 7;   // width of each continuation strip in px
const STRIP_GAP = 2; // gap between stacked strips in px

export default function DayCell({
  eventDisplays,
  sources,
  people,
  isToday,
  isCurrentMonth = true,
  maxEvents,
  hideLocation = false,
  onEventClick,
  eventLanes,
}: DayCellProps) {
  const multiDay  = eventDisplays.filter(e => e.position !== 'single');
  const singleDay = eventDisplays.filter(e => e.position === 'single');
  const firstDays = multiDay.filter(e => e.position === 'first');

  const allBadges = [...firstDays, ...singleDay];
  const cap = maxEvents ?? Infinity;
  const visibleBadges = allBadges.slice(0, cap);
  const hiddenCount = allBadges.length - visibleBadges.length;

  // Compute per-event lane (stable across cells) or fall back to index
  const multiDayWithLane = multiDay.map((ed, idx) => ({
    ...ed,
    lane: eventLanes?.get(ed.event.id) ?? idx,
  }));

  // Reserve right padding for highest lane present (so badges never overlap strips)
  const maxLane = multiDayWithLane.length > 0
    ? Math.max(...multiDayWithLane.map(e => e.lane))
    : -1;
  const stripReserve = maxLane >= 0 ? (maxLane + 1) * (STRIP_W + STRIP_GAP) : 0;

  return (
    <div
      className={`relative min-h-[36px] h-full flex flex-col ${
        isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      } ${!isCurrentMonth ? 'opacity-50' : ''}`}
    >
      {/* ── Absolutely positioned continuation strips (right side) ── */}
      {multiDayWithLane.map(({ event, position, lane }) => {
        const color = getEventColor(event, sources, people);
        const right = lane * (STRIP_W + STRIP_GAP);

        // first: rounded top, bleeds past bottom border
        // middle: no rounding, bleeds past both borders
        // last: rounded bottom, bleeds past top border
        const topOffset    = position === 'first' ? 2  : -3;
        const bottomOffset = position === 'last'  ? 2  : -3;
        const radius =
          position === 'first' ? '3px 3px 0 0' :
          position === 'last'  ? '0 0 3px 3px' : '0';

        return (
          <div key={`strip-${event.id}-${position}`}>
            {/* Vertical strip */}
            <div
              style={{
                position: 'absolute',
                right,
                width: STRIP_W,
                top: topOffset,
                bottom: bottomOffset,
                backgroundColor: color,
                borderRadius: radius,
                zIndex: 20,
                pointerEvents: 'none',
              }}
              title={event.title}
            />
            {/* Horizontal connector arm on the first day of a multi-day event */}
            {position === 'first' && (
              <div
                style={{
                  position: 'absolute',
                  right: right + STRIP_W,
                  left: 0,
                  top: topOffset + 6,
                  height: 2,
                  backgroundColor: color,
                  opacity: 0.4,
                  zIndex: 18,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })}

      {/* ── Event content (badges), right-padded to clear strips ── */}
      <div
        className="flex flex-col gap-0.5 px-1 py-1"
        style={{ paddingRight: stripReserve > 0 ? stripReserve + 4 : 4 }}
      >
        {/* Visible badges (multi-day first days + single-day events, capped) */}
        {visibleBadges.map(({ event }) => (
          <EventBadge
            key={event.id}
            event={event}
            sources={sources}
            people={people}
            position="single"
            hideLocation={hideLocation}
            onClick={onEventClick}
          />
        ))}
        {hiddenCount > 0 && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 px-0.5 leading-tight cursor-default select-none">
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
}
