'use client';

import { useMemo } from 'react';
import { eachDayOfInterval, addDays, isToday, getISOWeek, format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import DayCell, { type EventDisplay } from './DayCell';
import { computeEventLanes } from './calendarUtils';

interface RollingViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  dateFormat: string;
  onEventClick?: (event: CalendarEvent) => void;
}

function getDayLabel(day: Date, t: LocaleData): string {
  const dayIndex = (day.getDay() + 6) % 7;
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  return t.days.short[dayKeys[dayIndex]];
}

function buildEventDisplays(events: CalendarEvent[]): Record<string, Record<string, EventDisplay[]>> {
  const map: Record<string, Record<string, EventDisplay[]>> = {};
  for (const event of events) {
    const startStr = event.start_date.slice(0, 10);
    const endStr = (event.end_date || event.start_date).slice(0, 10);
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

export default function RollingView({ date, events, sources, people, t, locale, dateFormat, onEventClick }: RollingViewProps) {
  const days = useMemo(
    () => eachDayOfInterval({ start: date, end: addDays(date, 30) }),
    [date.getTime()]
  );

  const eventsByDate = useMemo(() => buildEventDisplays(events), [events]);
  const eventLanes = useMemo(() => computeEventLanes(events), [events]);

  let lastWeekNum = -1;
  let lastMonth = -1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="grid sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(people.length, 1)}, 1fr)` }}
      >
        <div className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-medium border-r border-gray-100 dark:border-gray-800 flex items-center justify-center">
          {t.calendar.weekNumber}
        </div>
        {people.length > 0 ? (
          people.map(person => (
            <div
              key={person.id}
              className="px-1 py-1.5 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0"
              style={{ borderTopColor: person.color, borderTopWidth: 3 }}
            >
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
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const today = isToday(day);
          const weekNum = getISOWeek(day);
          const isWeekBoundary = weekNum !== lastWeekNum;
          if (isWeekBoundary) lastWeekNum = weekNum;
          const isMonthBoundary = day.getMonth() !== lastMonth;
          if (isMonthBoundary) lastMonth = day.getMonth();
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = getHoliday(locale, dateStr);
          const dayLabel = getDayLabel(day, t);

          return (
            <div key={dateStr}>
              {isMonthBoundary && (
                <div
                  className="grid bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800"
                  style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(people.length, 1)}, 1fr)` }}
                >
                  <div className="px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border-r border-blue-200 dark:border-blue-800">
                    {format(day, 'MMM')}
                  </div>
                  <div className="col-span-full px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                    {format(day, 'MMMM yyyy')}
                  </div>
                </div>
              )}

              {isWeekBoundary && !isMonthBoundary && (
                <div
                  className="grid bg-gray-50 dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700"
                  style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(people.length, 1)}, 1fr)` }}
                >
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700">
                    {t.calendar.weekNumber} {weekNum}
                  </div>
                  {people.map(person => (
                    <div key={person.id} className="border-r border-gray-200 dark:border-gray-700 last:border-r-0" />
                  ))}
                </div>
              )}

              <div
                className={`grid border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                  today ? 'bg-blue-50/40 dark:bg-blue-900/10' : isWeekend ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''
                }`}
                style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(people.length, 1)}, 1fr)` }}
              >
                {/* Date label */}
                <div className={`px-1 py-1 flex flex-col items-center justify-start border-r border-gray-100 dark:border-gray-800 ${
                  today ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  <span className="text-xs font-medium">{dayLabel}</span>
                  <span className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                    today ? 'bg-blue-600 text-white' : ''
                  }`}>
                    {day.getDate()}
                  </span>
                  {holiday && (
                    <span className="text-xs leading-none mt-0.5">🇳🇴</span>
                  )}
                </div>

                {/* Per-person cells */}
                {people.length > 0 ? (
                  people.map(person => {
                    const personDisplays = eventsByDate[dateStr]?.[person.id] || [];
                    return (
                      <div
                        key={person.id}
                        className="border-r border-gray-100 dark:border-gray-800 last:border-r-0 flex flex-col"
                      >
                        <DayCell
                          eventDisplays={personDisplays}
                          sources={sources}
                          people={people}
                          isToday={today}
                          onEventClick={onEventClick}
                          eventLanes={eventLanes}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-xs text-gray-300 dark:text-gray-600 italic">Add people in Settings</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
