'use client';

import type { CalendarEvent, CalendarSource, Person } from '@/types';
import EventBadge, { getEventColor, getTextColor, type EventPosition } from './EventBadge';

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

  const multiDayWithLane = multiDay.map((ed, idx) => ({
    ...ed,
    lane: eventLanes?.get(ed.event.id) ?? idx,
  }));
  const sortedMultiDay = [...multiDayWithLane].sort((a, b) => a.lane - b.lane);
  const maxLane = sortedMultiDay.length > 0 ? Math.max(...sortedMultiDay.map(e => e.lane)) : -1;

  const cap = maxEvents ?? Infinity;
  const visibleSingle = singleDay.slice(0, cap);
  const hiddenCount = singleDay.length - visibleSingle.length;

  return (
    <div
      className={`flex flex-col min-h-[36px] h-full ${
        isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      } ${!isCurrentMonth ? 'opacity-50' : ''}`}
    >
      {/* Multi-day event ribbon bars — bleed across cell borders to show continuity */}
      {maxLane >= 0 && (
        <div className="flex flex-col gap-px pt-1 pb-0.5">
          {Array.from({ length: maxLane + 1 }, (_, lane) => {
            const ed = sortedMultiDay.find(e => e.lane === lane);
            if (!ed) {
              // Placeholder to keep lane positions aligned across days
              return <div key={`gap-${lane}`} className="h-5" />;
            }
            const { event, position } = ed;
            const color = getEventColor(event, sources, people);
            const textColor = getTextColor(color);
            const isStart = position === 'first';
            const isEnd   = position === 'last';

            return (
              <div
                key={`ribbon-${event.id}`}
                className="h-5 flex items-center overflow-hidden text-[11px] font-medium cursor-pointer hover:brightness-110 select-none"
                style={{
                  backgroundColor: color,
                  color: textColor,
                  // Indent start/end; bleed into borders for middle/continuation days
                  marginLeft:   isStart ? 4 : -1,
                  marginRight:  isEnd   ? 4 : -1,
                  borderRadius: isStart && isEnd ? 4
                              : isStart          ? '4px 0 0 4px'
                              : isEnd            ? '0 4px 4px 0'
                              : 0,
                  paddingLeft:  isStart ? 6 : 2,
                  paddingRight: 4,
                }}
                onClick={() => onEventClick?.(event)}
                title={event.title}
              >
                {/* Show title only on the first day so the ribbon label is clear */}
                {isStart && <span className="truncate leading-none">{event.title}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Single-day event badges */}
      <div className="flex flex-col gap-0.5 px-1 py-1">
        {visibleSingle.map(({ event }) => (
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
