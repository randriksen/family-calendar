'use client';

import { useMemo } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, getISOWeek, format
} from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import DayCell, { type EventDisplay } from './DayCell';
import { computeEventLanes, computeDaySingleSlots, buildCompareSlotsForDates } from './calendarUtils';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';
import { hexWithAlpha } from '@/lib/colorUtils';

interface WeekViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  dateFormat: string;
  timezone: string;
  onEventClick?: (event: CalendarEvent) => void;
  singlePersonId?: string;
  compareTimeSlots?: boolean;
}

function getDayLabel(day: Date, t: LocaleData): string {
  const dayIndex = (day.getDay() + 6) % 7;
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  return t.days.short[dayKeys[dayIndex]];
}

function buildEventDisplays(events: CalendarEvent[], timezone: string): Record<string, Record<string, EventDisplay[]>> {
  const map: Record<string, Record<string, EventDisplay[]>> = {};
  for (const event of events) {
    const { startStr, endStr } = getEventDateRangeKeys(event, timezone);
    const isMultiDay = startStr !== endStr;
    const cur = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (cur <= end) {
      const key = format(cur, 'yyyy-MM-dd');
      if (!map[key]) map[key] = {};
      if (!map[key][event.person_id]) map[key][event.person_id] = [];
      let position: EventDisplay['position'];
      if (!isMultiDay) position = 'single';
      else if (key === startStr) position = 'first';
      else if (key === endStr) position = 'last';
      else position = 'middle';
      map[key][event.person_id].push({ event, position });
      cur.setDate(cur.getDate() + 1);
    }
  }
  for (const dateKey of Object.keys(map)) {
    for (const personId of Object.keys(map[dateKey])) {
      map[dateKey][personId].sort((a, b) => {
        const aM = a.position !== 'single' ? 0 : 1;
        const bM = b.position !== 'single' ? 0 : 1;
        if (aM !== bM) return aM - bM;
        return a.event.start_date.localeCompare(b.event.start_date);
      });
    }
  }
  return map;
}

export default function WeekView({ date, events, sources, people, t, locale, dateFormat, timezone, onEventClick, singlePersonId, compareTimeSlots = false }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const weekNum = getISOWeek(weekStart);

  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart.getTime()]
  );

  const eventsByDate = useMemo(() => buildEventDisplays(events, timezone), [events, timezone]);
  const eventLanes = useMemo(() => computeEventLanes(events), [events]);

  const singleDaySlotsByDate = useMemo(() => {
    const result: Record<string, { slots: Map<string, number>; total: number }> = {};
    for (const dateStr of days.map(d => format(d, 'yyyy-MM-dd'))) {
      const allSingle = Object.values(eventsByDate[dateStr] ?? {})
        .flat()
        .filter(ed => ed.position === 'single')
        .map(ed => ed.event);
      result[dateStr] = computeDaySingleSlots(allSingle);
    }
    return result;
  }, [eventsByDate, days]);

  const sharedMaxLaneByDate = useMemo(() => {
    const result: Record<string, number> = {};
    for (const dateStr of days.map(d => format(d, 'yyyy-MM-dd'))) {
      let maxLane = -1;
      for (const personEvents of Object.values(eventsByDate[dateStr] ?? {})) {
        const multiDay = personEvents.filter(ed => ed.position !== 'single');
        multiDay.forEach((ed, idx) => {
          const lane = eventLanes.get(ed.event.id) ?? idx;
          if (lane > maxLane) maxLane = lane;
        });
      }
      result[dateStr] = maxLane;
    }
    return result;
  }, [eventsByDate, eventLanes, days]);

  const displayedPeople = singlePersonId
    ? people.filter(p => p.id === singlePersonId)
    : people;
  const colCount = Math.max(displayedPeople.length, 1);
  const gridCols = singlePersonId ? `3.5rem 1fr` : `3.5rem repeat(${colCount}, minmax(0, 1fr))`;

    // Pre-compute concurrent time slots for all visible days in one pass.
    // Result is stable across re-renders until events/people/timezone actually change.
    const compareSlotsByDate = useMemo(() => {
      if (!compareTimeSlots || displayedPeople.length === 0) return {} as Record<string, import('./calendarUtils').CompareSlot[]>;
      const dateKeys = days.map(d => format(d, 'yyyy-MM-dd'));
      return buildCompareSlotsForDates(dateKeys, events, displayedPeople, timezone, t.calendar.allDay);
    }, [compareTimeSlots, days, events, displayedPeople, timezone, t.calendar.allDay]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="grid sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-medium border-r border-gray-100 dark:border-gray-800 flex items-center justify-center">
          {t.calendar.weekNumber} {weekNum}
        </div>
        {displayedPeople.length > 0 ? (
          displayedPeople.map(person => (
            <div
              key={person.id}
              className="px-1 py-1.5 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0"
              style={{ borderTopColor: person.color, borderTopWidth: 3 }}
            >
              {person.photo_url && (
                <img src={person.photo_url} alt={person.name} className="w-7 h-7 rounded-full mx-auto mb-0.5 object-cover" />
              )}
              <span className="font-bold text-xs truncate block" style={{ color: person.color }}>
                {person.name}
              </span>
            </div>
          ))
        ) : (
          <div className="px-2 py-2 text-center text-sm text-gray-400 dark:text-gray-500">No people</div>
        )}
      </div>

      {/* Day rows */}
      <div className="flex-1 overflow-auto">
        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const today = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = getHoliday(locale, dateStr);
          const dayLabel = getDayLabel(day, t);
          const showMonth = idx === 0 || day.getDate() === 1;
          const isEvenRow = idx % 2 === 0;

          const { slots: singleDaySlots, total: totalSingleSlots } = singleDaySlotsByDate[dateStr] ?? { slots: new Map(), total: 0 };
          const sharedMaxLane = sharedMaxLaneByDate[dateStr] ?? -1;

          return (
            <div
              key={dateStr}
              className={`grid border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                today    ? 'bg-blue-50 dark:bg-blue-900/20' :
                isWeekend ? 'bg-amber-50 dark:bg-amber-900/15' :
                isEvenRow ? 'bg-[#F0F4F8] dark:bg-[#1B2431]' : 'bg-white dark:bg-[#2E3F52]'
              }`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Date label */}
              <div className={`px-1 py-2 flex flex-col items-center justify-start border-r border-gray-100 dark:border-gray-800 ${
                today ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
              }`}>
                <span className="text-xs font-medium">{dayLabel}</span>
                <span className={`text-base font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                  today ? 'bg-blue-600 text-white' : ''
                }`}>
                  {day.getDate()}
                </span>
                {showMonth && (
                  <span className="text-[9px] font-medium leading-none mt-0.5 uppercase tracking-wide opacity-60">
                    {format(day, 'MMM')}
                  </span>
                )}
                {holiday && (
                  <span className="text-xs text-red-400 text-center leading-tight mt-0.5">🇳🇴</span>
                )}
              </div>

              {/* Per-person cells */}
              {displayedPeople.length > 0 ? (
                displayedPeople.map(person => {
                  const personDisplays = eventsByDate[dateStr]?.[person.id] || [];
                  const compareSlots = compareSlotsByDate[dateStr] ?? [];
                  return (
                    <div
                      key={person.id}
                      className="border-r border-gray-100 dark:border-gray-800 last:border-r-0 flex flex-col overflow-hidden"
                      style={{ backgroundColor: hexWithAlpha(person.color, isEvenRow ? 0.12 : 0.06) }}
                    >
                      {compareTimeSlots ? (
                        <div className="flex flex-col">
                          {compareSlots.length === 0 ? (
                            <div className="px-2 py-2 text-[11px] text-gray-300 dark:text-gray-600">&nbsp;</div>
                          ) : (
                            compareSlots.map(slot => {
                              const list = slot.byPerson[person.id] ?? [];
                              const first = list[0];
                              return (
                                <div key={slot.key} className="h-10 px-1 py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 overflow-hidden">
                                  {first ? (
                                    <button
                                      onClick={() => onEventClick?.(first)}
                                      className="w-full h-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium text-white hover:opacity-90 flex flex-col justify-center"
                                      style={{ backgroundColor: person.color }}
                                      title={first.title}
                                    >
                                      <div className="flex items-baseline gap-1 overflow-hidden">
                                        <span className="truncate flex-1">{first.title}</span>
                                        {list.length > 1 && <span className="flex-shrink-0 opacity-85">+{list.length - 1}</span>}
                                      </div>
                                      {slot.key !== 'all-day' && (
                                        <div className="opacity-85 text-[10px] leading-none mt-0.5">{formatTzTime(first.start_date, timezone)}</div>
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <DayCell
                          eventDisplays={personDisplays}
                          sources={sources}
                          people={people}
                          isToday={today}
                          maxEvents={3}
                          hideLocation
                          timezone={timezone}
                          onEventClick={onEventClick}
                          eventLanes={eventLanes}
                          singleDaySlots={singleDaySlots}
                          totalSingleSlots={totalSingleSlots}
                          sharedMaxLane={sharedMaxLane}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-2 py-2 text-xs text-gray-300 dark:text-gray-600 italic">Add people in Settings</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

