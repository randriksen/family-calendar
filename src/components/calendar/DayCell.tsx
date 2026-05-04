'use client';

import type { CalendarEvent, CalendarSource, Person } from '@/types';
import EventBadge, { getEventColor, getTextColor, type EventPosition } from './EventBadge';
import { formatTzTime } from '@/lib/tz';

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
  timezone: string;
  onEventClick?: (event: CalendarEvent) => void;
  eventLanes?: Map<string, number>;
}

const STRIP_W = 8;
const STRIP_GAP = 2;
const LANE_H = 22;   // height of each multi-day ribbon row in px
const LANE_GAP = 2;
const LANE_TOP = 4;  // top padding before first ribbon row


export default function DayCell({
  eventDisplays,
  sources,
  people,
  isToday,
  isCurrentMonth = true,
  maxEvents,
  hideLocation = false,
  timezone,
  onEventClick,
  eventLanes,
}: DayCellProps) {
  const multiDay  = eventDisplays.filter(e => e.position !== 'single');
  const singleDay = eventDisplays.filter(e => e.position === 'single');

  const multiDayWithLane = multiDay.map((ed, idx) => ({
    ...ed,
    lane: eventLanes?.get(ed.event.id) ?? idx,
  }));
  const maxLane = multiDayWithLane.length > 0
    ? Math.max(...multiDayWithLane.map(e => e.lane))
    : -1;

  const cap = maxEvents ?? Infinity;
  const visibleSingle = singleDay.slice(0, cap);
  const hiddenCount = singleDay.length - visibleSingle.length;

  // Width reserved on the right for all strips
  const stripReserve = maxLane >= 0 ? (maxLane + 1) * (STRIP_W + STRIP_GAP) : 0;

  // Total height of the ribbon area (above single-day badges)
  const ribbonAreaH = maxLane >= 0
    ? LANE_TOP + (maxLane + 1) * (LANE_H + LANE_GAP)
    : 0;

  return (
    <div
      className={`relative min-h-[36px] h-full flex flex-col ${
        !isCurrentMonth ? 'opacity-50' : ''
      }`}
    >
      {/* ── Vertical strips — full-height bars on the right ── */}
      {multiDayWithLane.map(({ event, position, lane }) => {
        const color = getEventColor(event, sources, people);
        const right = lane * (STRIP_W + STRIP_GAP);
        // First day: strip starts at ribbon row top; others bleed from above
        const topOffset    = position === 'first'
          ? LANE_TOP + lane * (LANE_H + LANE_GAP)
          : -2;
        // Last day: strip ends at ribbon row bottom; others bleed past bottom
        const bottomOffset = position === 'last'
          ? `calc(100% - ${LANE_TOP + (lane + 1) * (LANE_H + LANE_GAP) - LANE_GAP}px)`
          : '0px';

        const radius =
          position === 'first' ? '3px 3px 0 0' :
          position === 'last'  ? '0 0 3px 3px' : '0';

        return (
          <div
            key={`strip-${event.id}-${position}`}
            style={{
              position: 'absolute',
              right,
              width: STRIP_W,
              top: topOffset,
              bottom: bottomOffset,
              backgroundColor: color,
              borderRadius: radius,
              zIndex: 10,
              cursor: 'pointer',
            }}
            onClick={() => onEventClick?.(event)}
            title={event.title}
          />
        );
      })}

      {/* ── Ribbon rows: one per lane, connecting badge to strip ── */}
      {maxLane >= 0 && (
        <div style={{ paddingTop: LANE_TOP }}>
          {Array.from({ length: maxLane + 1 }, (_, lane) => {
            const ed = multiDayWithLane.find(e => e.lane === lane);

            if (!ed) {
              return <div key={`gap-${lane}`} style={{ height: LANE_H, marginBottom: LANE_GAP }} />;
            }

            const { event, position } = ed;
            const color = getEventColor(event, sources, people);
            const textColor = getTextColor(color);
            const isFirst = position === 'first';
            const isLast  = position === 'last';
            const showBand = isFirst || isLast;
            const timeStr = !event.all_day ? formatTzTime(event.start_date, timezone) : '';
            const rightPad = stripReserve + 4;

            // Middle days: just a spacer — only the vertical strip shows
            if (!showBand) {
              return <div key={`ribbon-${event.id}`} style={{ height: LANE_H, marginBottom: LANE_GAP }} />;
            }

            return (
              <div
                key={`ribbon-${event.id}`}
                style={{
                  height: LANE_H,
                  marginBottom: LANE_GAP,
                  backgroundColor: color,
                  paddingRight: rightPad,
                  cursor: 'pointer',
                }}
                className="flex items-center overflow-hidden px-1.5 select-none hover:brightness-95"
                onClick={() => onEventClick?.(event)}
                title={event.title}
              >
                {isFirst && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium truncate leading-none"
                    style={{ color: textColor }}
                  >
                    {timeStr && (
                      <span className="flex-shrink-0 opacity-75 font-normal">{timeStr}</span>
                    )}
                    <span className="truncate">{event.title}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Single-day event badges ── */}
      <div className="flex flex-col gap-0.5 px-1 py-1" style={{ paddingRight: stripReserve > 0 ? stripReserve + 4 : 4 }}>
        {visibleSingle.map(({ event }) => (
          <EventBadge
            key={event.id}
            event={event}
            sources={sources}
            people={people}
            timezone={timezone}
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
