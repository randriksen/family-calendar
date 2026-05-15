'use client';

import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { eachDayOfInterval, addDays, isToday, getISOWeek, format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import DayCell, { type EventDisplay } from './DayCell';
import { computeEventLanes, computeDaySingleSlots } from './calendarUtils';
import { getEventDateRangeKeys } from '@/lib/tz';
import { hexWithAlpha } from '@/lib/colorUtils';

const INITIAL_PAST = 30;
const LOAD_MORE = 30;

interface RollingViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  dateFormat: string;
  timezone: string;
  rollingDays: number;
  onEventClick?: (event: CalendarEvent) => void;
  singlePersonId?: string;
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

export default function RollingView({ date, events, sources, people, t, locale, timezone, rollingDays, onEventClick, singlePersonId }: RollingViewProps) {
  const [extraPast, setExtraPast] = useState(INITIAL_PAST);
  const [extraFuture, setExtraFuture] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const prevScrollHeight = useRef(0);
  const isPrepending = useRef(false);
  const anchorStr = format(date, 'yyyy-MM-dd');

  const days = useMemo(
    () => eachDayOfInterval({
      start: addDays(date, -extraPast),
      end: addDays(date, rollingDays - 1 + extraFuture),
    }),
    [date.getTime(), rollingDays, extraPast, extraFuture]
  );

  const eventsByDate = useMemo(() => buildEventDisplays(events, timezone), [events, timezone]);
  const eventLanes = useMemo(() => computeEventLanes(events), [events]);

  const displayedPeople = singlePersonId
    ? people.filter(p => p.id === singlePersonId)
    : people;
  const gridCols = singlePersonId ? `3.5rem 1fr` : `3.5rem repeat(${Math.max(displayedPeople.length, 1)}, minmax(0, 1fr))`;

  // Scroll to anchor date when date prop changes (Today / Prev / Next)
  useEffect(() => {
    anchorRef.current?.scrollIntoView({ block: 'start' });
  }, [date.getTime()]);

  // After prepending past days, restore scroll position so view doesn't jump
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (isPrepending.current && container && prevScrollHeight.current > 0) {
      container.scrollTop += container.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = 0;
      isPrepending.current = false;
    }
  }, [extraPast]);

  // Top sentinel: load more past days when user scrolls near the top
  const topSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isPrepending.current) {
          isPrepending.current = true;
          prevScrollHeight.current = container.scrollHeight;
          setExtraPast(p => p + LOAD_MORE);
        }
      },
      { root: container, rootMargin: '200px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Bottom sentinel: load more future days when user scrolls near the bottom
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setExtraFuture(f => f + LOAD_MORE);
        }
      },
      { root: container, rootMargin: '0px 0px 200px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  let lastWeekNum = -1;
  let lastMonth = -1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="grid sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500 font-medium border-r border-gray-100 dark:border-gray-800 flex items-center justify-center">
          {t.calendar.weekNumber}
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
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div ref={topSentinelRef} />
        {days.map((day, dayIdx) => {
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
          const isEvenRow = dayIdx % 2 === 0;

          const allSingleForDay = Object.values(eventsByDate[dateStr] ?? {})
            .flat()
            .filter(ed => ed.position === 'single')
            .map(ed => ed.event);
          const { slots: singleDaySlots, total: totalSingleSlots } = computeDaySingleSlots(allSingleForDay);

          return (
            <div key={dateStr} ref={dateStr === anchorStr ? anchorRef : undefined}>
              {isMonthBoundary && (
                <div
                  className="grid bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border-r border-blue-200 dark:border-blue-800">
                    {format(day, 'MMM')}
                  </div>
                  <div className="col-span-full px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                    {format(day, 'MMMM yyyy')}
                  </div>
                </div>
              )}

              <div
                className={`grid border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                  today     ? 'bg-blue-50 dark:bg-blue-900/20' :
                  isWeekend ? 'bg-amber-50 dark:bg-amber-900/15' :
                  isEvenRow ? 'bg-[#F0F4F8] dark:bg-[#1B2431]' : 'bg-white dark:bg-[#2E3F52]'
                }`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className={`px-1 py-1 flex flex-col items-center justify-start border-r border-gray-100 dark:border-gray-800 ${
                  today ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  <span className="text-xs font-medium">{dayLabel}</span>
                  <span className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                    today ? 'bg-blue-600 text-white' : ''
                  }`}>
                    {day.getDate()}
                  </span>
                  {isWeekBoundary && !isMonthBoundary && (
                    <span className="text-[9px] font-medium leading-none mt-0.5 opacity-60">
                      {t.calendar.weekNumber} {weekNum}
                    </span>
                  )}
                  {holiday && (
                    <span className="text-xs leading-none mt-0.5">🇳🇴</span>
                  )}
                </div>

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
                          maxEvents={3}
                          hideLocation
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
                  <div className="px-2 py-2 text-xs text-gray-300 dark:text-gray-600 italic">Add people in Settings</div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomSentinelRef} />
      </div>
    </div>
  );
}
