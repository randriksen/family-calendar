'use client';

import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, getISOWeek, format
} from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import DayCell, { type EventDisplay } from './DayCell';
import { computeEventLanes, computeDaySingleSlots } from './calendarUtils';
import { toTzDateStr } from '@/lib/tz';
import { hexWithAlpha } from '@/lib/colorUtils';

interface MonthViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  timezone: string;
  onEventClick?: (event: CalendarEvent) => void;
  singlePersonId?: string;
}

function getShortDayName(t: LocaleData, day: Date): string {
  const names = [
    t.days.short.sunday,
    t.days.short.monday,
    t.days.short.tuesday,
    t.days.short.wednesday,
    t.days.short.thursday,
    t.days.short.friday,
    t.days.short.saturday,
  ];
  return names[day.getDay()];
}

export default function MonthView({ date, events, sources, people, t, locale, timezone, onEventClick, singlePersonId }: MonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  const days = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthStart.getTime(), monthEnd.getTime()]
  );

  const displayedPeople = singlePersonId
    ? people.filter(p => p.id === singlePersonId)
    : people;

  const gridCols = singlePersonId
    ? `3.5rem 1fr`
    : `3.5rem repeat(${Math.max(displayedPeople.length, 1)}, minmax(0, 1fr))`;

  // Stable lane assignments for multi-day events
  const eventLanes = useMemo(() => computeEventLanes(events), [events]);

  // Build map: dateStr → personId → EventDisplay[]
  // Multi-day events get positional markers; single-day get 'single'
  const eventsByDate = useMemo(() => {
    const map: Record<string, Record<string, EventDisplay[]>> = {};

    for (const event of events) {
      const startStr = event.all_day
        ? event.start_date.slice(0, 10)
        : toTzDateStr(new Date(event.start_date), timezone);
      const endIso = event.end_date || event.start_date;
      const endStr = event.all_day
        ? endIso.slice(0, 10)
        : toTzDateStr(new Date(endIso), timezone);
      const isMultiDay = startStr !== endStr;

      const cur = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      while (cur <= end) {
        const key = format(cur, 'yyyy-MM-dd');
        if (!map[key]) map[key] = {};
        if (!map[key][event.person_id]) map[key][event.person_id] = [];

        let position: EventDisplay['position'];
        if (!isMultiDay) {
          position = 'single';
        } else if (key === startStr) {
          position = 'first';
        } else if (key === endStr) {
          position = 'last';
        } else {
          position = 'middle';
        }

        map[key][event.person_id].push({ event, position });
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Sort each cell: multi-day first (by start_date), then single-day (by start_date)
    for (const dateKey of Object.keys(map)) {
      for (const personId of Object.keys(map[dateKey])) {
        map[dateKey][personId].sort((a, b) => {
          const aMulti = a.position !== 'single' ? 0 : 1;
          const bMulti = b.position !== 'single' ? 0 : 1;
          if (aMulti !== bMulti) return aMulti - bMulti;
          return a.event.start_date.localeCompare(b.event.start_date);
        });
      }
    }

    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="grid sticky top-0 z-10 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-medium border-r border-gray-200 dark:border-gray-700">
          {t.calendar.weekNumber}
        </div>
        {displayedPeople.length > 0 ? (
          displayedPeople.map(person => (
            <div
              key={person.id}
              className="px-1 py-1.5 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 flex flex-col items-center gap-0.5"
              style={{ borderTopColor: person.color, borderTopWidth: 3 }}
            >
              {person.photo_url && (
                <img src={person.photo_url} alt={person.name} className="w-7 h-7 rounded-full mx-auto mb-0.5 object-cover" />
              )}
              <span className="font-bold text-xs truncate w-full text-center" style={{ color: person.color }}>
                {person.name}
              </span>
            </div>
          ))
        ) : (
          <div className="px-2 py-2 text-center text-sm text-gray-400 dark:text-gray-500 italic">
            Add people in Settings
          </div>
        )}
      </div>

      {/* Day rows */}
      <div className="flex-1 overflow-auto">
        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const today = isToday(day);
          const isMonday = day.getDay() === 1;
          const showWeekNum = isMonday || day.getDate() === 1;
          const weekNum = showWeekNum ? getISOWeek(day) : null;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = getHoliday(locale, dateStr);
          const shortDayName = getShortDayName(t, day);
          const isEvenRow = idx % 2 === 0;

          // Compute shared single-day slots across all persons for alignment
          const allSingleForDay = Object.values(eventsByDate[dateStr] ?? {})
            .flat()
            .filter(ed => ed.position === 'single')
            .map(ed => ed.event);
          const { slots: singleDaySlots, total: totalSingleSlots } = computeDaySingleSlots(allSingleForDay);

          return (
            <div
              key={dateStr}
              className={`grid ${
                isMonday ? 'border-t-2 border-t-gray-200 dark:border-t-gray-700' : 'border-t border-t-gray-100 dark:border-t-gray-800'
              } ${
                today    ? 'bg-blue-50 dark:bg-blue-900/20' :
                isWeekend ? 'bg-amber-50 dark:bg-amber-900/15' :
                isEvenRow ? 'bg-[#F0F4F8] dark:bg-[#1B2431]' : 'bg-white dark:bg-[#2E3F52]'
              }`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Left column */}
              <div
                className={`px-1.5 py-1 flex flex-col items-center justify-start border-r border-gray-200 dark:border-gray-700 min-w-0 select-none ${
                  today ? 'text-blue-600' : isWeekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {weekNum !== null ? (
                  <span className="text-[10px] font-medium text-gray-300 dark:text-gray-600 leading-none mb-0.5">
                    {weekNum}
                  </span>
                ) : (
                  <span className="text-[10px] leading-none mb-0.5 invisible">·</span>
                )}
                <span
                  className={`text-sm font-bold leading-none w-7 h-7 flex items-center justify-center rounded-full ${
                    today ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="text-[10px] leading-none mt-0.5 font-medium">
                  {shortDayName}
                </span>
                {holiday && (
                  <span
                    className="text-[9px] text-red-500 text-center leading-tight mt-0.5 font-medium max-w-full overflow-hidden"
                    title={holiday}
                  >
                    {holiday.length > 10 ? holiday.slice(0, 9) + '…' : holiday}
                  </span>
                )}
              </div>

              {/* Per-person event cells */}
              {displayedPeople.length > 0 ? (
                displayedPeople.map(person => {
                  const personDisplays = eventsByDate[dateStr]?.[person.id] || [];
                  return (
                    <div
                      key={person.id}
                      className="border-r border-gray-100 dark:border-gray-800 last:border-r-0 flex flex-col overflow-hidden"
                      style={{ backgroundColor: hexWithAlpha(person.color, isEvenRow ? 0.12 : 0.06) }}
                    >
                      <DayCell
                        eventDisplays={personDisplays}
                        sources={sources}
                        people={people}
                        isToday={today}
                        isCurrentMonth={true}
                        timezone={timezone}
                        onEventClick={onEventClick}
                        eventLanes={eventLanes}
                        singleDaySlots={singleDaySlots}
                        totalSingleSlots={totalSingleSlots}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="px-2 py-3 text-xs text-gray-300 dark:text-gray-600 italic col-span-1">
                  No people configured
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
