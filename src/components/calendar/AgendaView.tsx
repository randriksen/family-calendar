'use client';

import { useState, useMemo } from 'react';
import { isToday, isTomorrow, format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday, getMonthName } from '@/lib/i18n';
import { getEventColor } from './EventBadge';
import { toTzDateStr, formatTzTime } from '@/lib/tz';

interface AgendaViewProps {
  date: Date;
  events: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  t: LocaleData;
  locale: string;
  timezone: string;
  onEventClick?: (event: CalendarEvent) => void;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function getTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#000';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#1f2937' : '#ffffff';
}


function getDateLabel(day: Date, t: LocaleData, locale: string): string {
  if (isToday(day)) return t.agenda.today;
  if (isTomorrow(day)) return t.agenda.tomorrow;
  const monthKey = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ][day.getMonth()] as keyof typeof t.months;
  return `${day.getDate()} ${t.months[monthKey]}`;
}

interface DayGroup {
  date: Date;
  dateStr: string;
  items: Array<{ event: CalendarEvent; persons: Person[] }>;
  holiday: string | null;
}

export default function AgendaView({ date, events, sources, people, t, locale, timezone, onEventClick }: AgendaViewProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    if (!selectedPersonId) return events;
    return events.filter(e => e.person_id === selectedPersonId);
  }, [events, selectedPersonId]);

  // Group events by day
  const groups = useMemo(() => {
    const map = new Map<string, DayGroup>();

    for (const event of filteredEvents) {
      const startStr = toTzDateStr(new Date(event.start_date), timezone);
      const endStr = event.end_date ? toTzDateStr(new Date(event.end_date), timezone) : startStr;
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      const cur = new Date(start);

      while (cur <= end) {
        const key = format(cur, 'yyyy-MM-dd');
        if (!map.has(key)) {
          map.set(key, {
            date: new Date(cur),
            dateStr: key,
            items: [],
            holiday: getHoliday(locale, key),
          });
        }
        const person = people.find(p => p.id === event.person_id);
        // Deduplicate by logical key: same ical_uid+source_id or same event.id
        const logicalKey = event.ical_uid ? `${event.source_id}:${event.ical_uid}` : event.id;
        const existing = map.get(key)!.items.find(item => {
          const k = item.event.ical_uid
            ? `${item.event.source_id}:${item.event.ical_uid}`
            : item.event.id;
          return k === logicalKey;
        });
        if (existing) {
          if (person && !existing.persons.find(p => p.id === person.id)) {
            existing.persons.push(person);
          }
        } else {
          map.get(key)!.items.push({ event, persons: person ? [person] : [] });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredEvents, people, locale]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, DayGroup[]>();
    for (const group of groups) {
      const monthKey = format(group.date, 'yyyy-MM');
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(group);
    }
    return map;
  }, [groups]);

  return (
    <div className="flex flex-col h-full">
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
          {t.agenda.all}
        </button>
        {people.map(person => (
          <button
            key={person.id}
            onClick={() => setSelectedPersonId(selectedPersonId === person.id ? null : person.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors border-2`}
            style={
              selectedPersonId === person.id
                ? { backgroundColor: person.color, color: getTextColor(person.color), borderColor: person.color }
                : { borderColor: person.color, color: person.color, backgroundColor: 'transparent' }
            }
          >
            {person.photo_url ? (
              <img src={person.photo_url} className="w-5 h-5 rounded-full object-cover" alt={person.name} />
            ) : (
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: person.color }} />
            )}
            <span>{person.name}</span>
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-auto">
        {groups.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
            {t.agenda.noUpcoming}
          </div>
        ) : (
          Array.from(monthGroups.entries()).map(([monthKey, monthDays]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = getMonthName(locale, month - 1);

            return (
              <div key={monthKey}>
                {/* Month header */}
                <div className="sticky top-[52px] z-[5] bg-gray-50 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 px-4 py-1.5">
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {monthName} {year}
                  </span>
                </div>

                {monthDays.map(group => {
                  const today = isToday(group.date);
                  const isWeekend = group.date.getDay() === 0 || group.date.getDay() === 6;
                  const dayIndex = (group.date.getDay() + 6) % 7;
                  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
                  const dayName = t.days.short[dayKeys[dayIndex]];

                  return (
                    <div
                      key={group.dateStr}
                      className={`flex border-b border-gray-100 dark:border-gray-800 ${
                        today ? 'bg-blue-50/30 dark:bg-blue-900/10' : isWeekend ? 'bg-gray-50/40 dark:bg-gray-800/20' : ''
                      }`}
                    >
                      {/* Date column */}
                      <div className={`flex-shrink-0 w-16 pt-3 pb-2 px-2 flex flex-col items-center ${
                        today ? 'text-blue-600' : isWeekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <span className="text-xs font-medium uppercase">{dayName}</span>
                        <span className={`text-2xl font-bold leading-tight ${
                          today ? 'text-blue-600' : ''
                        }`}>
                          {group.date.getDate()}
                        </span>
                        {group.holiday && (
                          <span className="text-xs mt-0.5">🇳🇴</span>
                        )}
                      </div>

                      {/* Events */}
                      <div className="flex-1 py-2 pr-3 space-y-1">
                        {group.holiday && (
                          <div className="text-xs text-red-500 font-medium px-1">{group.holiday}</div>
                        )}
                        {group.items.map(({ event, persons }, idx) => {
                          const color = getEventColor(event, sources, people);
                          const textColor = getTextColor(color);
                          const time = !event.all_day ? formatTzTime(event.start_date, timezone) : '';

                          return (
                            <div
                              key={`${event.id}-${idx}`}
                              className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: color, color: textColor }}
                              onClick={() => onEventClick?.(event)}
                              onContextMenu={e => { e.preventDefault(); onEventClick?.(event); }}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="flex items-center gap-2 text-xs opacity-80 mt-0.5">
                                  {time && <span>{time}</span>}
                                  {event.location && (
                                    <span className="truncate">📍 {event.location}</span>
                                  )}
                                  {persons.length > 0 && (
                                    <span className="font-medium">{persons.map(p => p.name).join(', ')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
