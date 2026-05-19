'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';

interface SlotDayViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  dateFormat: string;
  timezone: string;
  onEventClick?: (event: CalendarEvent) => void;
}

interface EventItem {
  event: CalendarEvent;
  person?: Person;
  source?: CalendarSource;
  minute: number;
}

function toTzHourMinute(dateStr: string, timezone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(dateStr));
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export default function SlotDayView({
  date,
  events,
  sources,
  people,
  t,
  locale,
  dateFormat,
  timezone,
  onEventClick,
}: SlotDayViewProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const dayKey = format(date, 'yyyy-MM-dd');

  const displayedPeople = useMemo(
    () => (selectedPersonId ? people.filter(p => p.id === selectedPersonId) : people),
    [people, selectedPersonId],
  );

  const { allDayByPerson, timedByHourPerson } = useMemo(() => {
    const allDayMap: Record<string, EventItem[]> = {};
    const hourMap: Record<number, Record<string, EventItem[]>> = {};

    for (let hour = 0; hour < 24; hour += 1) hourMap[hour] = {};

    for (const person of displayedPeople) {
      allDayMap[person.id] = [];
      for (let hour = 0; hour < 24; hour += 1) hourMap[hour][person.id] = [];
    }

    for (const event of events) {
      if (selectedPersonId && event.person_id !== selectedPersonId) continue;

      const { startStr, endStr } = getEventDateRangeKeys(event, timezone);
      if (dayKey < startStr || dayKey > endStr) continue;

      const person = people.find(p => p.id === event.person_id);
      if (!person) continue;
      const source = sources.find(s => s.id === event.source_id);

      if (event.all_day) {
        allDayMap[person.id].push({ event, person, source, minute: 0 });
        continue;
      }

      let hour = 0;
      let minute = 0;
      if (startStr === dayKey) {
        const hm = toTzHourMinute(event.start_date, timezone);
        hour = hm.hour;
        minute = hm.minute;
      }

      hourMap[hour][person.id].push({ event, person, source, minute });
    }

    for (const personId of Object.keys(allDayMap)) {
      allDayMap[personId].sort((a, b) => a.event.start_date.localeCompare(b.event.start_date));
    }

    for (let hour = 0; hour < 24; hour += 1) {
      for (const personId of Object.keys(hourMap[hour])) {
        hourMap[hour][personId].sort((a, b) => {
          if (a.minute !== b.minute) return a.minute - b.minute;
          return a.event.start_date.localeCompare(b.event.start_date);
        });
      }
    }

    return { allDayByPerson: allDayMap, timedByHourPerson: hourMap };
  }, [events, people, sources, timezone, dayKey, selectedPersonId, displayedPeople]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const holiday = getHoliday(locale, format(date, 'yyyy-MM-dd'));
  const gridTemplateColumns = `4.5rem repeat(${Math.max(displayedPeople.length, 1)}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Person filter chips */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex gap-2 overflow-x-auto shadow-sm" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedPersonId(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selectedPersonId === null
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {t.nav.all}
        </button>
        {people.map(person => (
          <button
            key={person.id}
            onClick={() => setSelectedPersonId(selectedPersonId === person.id ? null : person.id)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors border-2`}
            style={
              selectedPersonId === person.id
                ? { backgroundColor: person.color, color: '#ffffff', borderColor: person.color }
                : { borderColor: person.color, color: person.color, backgroundColor: 'transparent' }
            }
          >
            <span>{person.name}</span>
          </button>
        ))}
      </div>

      {/* Day header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {format(date, dateFormat)}
        </div>
        {holiday && (
          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium mt-1">
            {t.calendar.holiday}: {holiday}
          </div>
        )}
      </div>

      {/* Compared grid */}
      <div className="flex-1 overflow-auto">
        {displayedPeople.length > 0 && (
          <div className="sticky top-0 z-[5] grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" style={{ gridTemplateColumns }}>
            <div className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
              {t.calendar.allDay}
            </div>
            {displayedPeople.map(person => (
              <div key={person.id} className="px-2 py-2 text-xs font-semibold truncate border-r border-gray-200 dark:border-gray-700 last:border-r-0" style={{ color: person.color }}>
                {person.name}
              </div>
            ))}
          </div>
        )}

        {displayedPeople.length > 0 && (
          <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns }}>
            <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
              {t.calendar.allDay}
            </div>
            {displayedPeople.map(person => {
              const items = allDayByPerson[person.id] ?? [];
              return (
                <div key={person.id} className="px-2 py-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0 min-h-14">
                  {items.length > 0 ? (
                    <div className="space-y-1">
                      {items.map(item => (
                        <button
                          key={item.event.id}
                          onClick={() => onEventClick?.(item.event)}
                          className="w-full text-left px-2 py-1 rounded text-xs font-medium text-white hover:opacity-90"
                          style={{ backgroundColor: person.color }}
                          title={item.event.title}
                        >
                          <span className="truncate block">{item.event.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300 dark:text-gray-600">&nbsp;</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {hours.map(hour => (
            <div key={hour} className="grid min-h-16" style={{ gridTemplateColumns }}>
              <div className="px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 text-right">
                {`${String(hour).padStart(2, '0')}:00`}
              </div>
              {displayedPeople.map(person => {
                const items = timedByHourPerson[hour]?.[person.id] ?? [];
                return (
                  <div key={person.id} className="px-2 py-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0 bg-white dark:bg-gray-900">
                    {items.length > 0 ? (
                      <div className="space-y-1">
                        {items.map(item => (
                          <button
                            key={item.event.id}
                            onClick={() => onEventClick?.(item.event)}
                            className="w-full text-left px-2 py-1.5 rounded text-xs font-medium text-white hover:opacity-90"
                            style={{ backgroundColor: person.color }}
                            title={item.event.title}
                          >
                            <span className="truncate block">{item.event.title}</span>
                            <span className="opacity-90">{formatTzTime(item.event.start_date, timezone)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 dark:text-gray-600">&nbsp;</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
