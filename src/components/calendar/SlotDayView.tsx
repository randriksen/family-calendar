'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getHoliday } from '@/lib/i18n';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';

const DEFAULT_HOUR_HEIGHT = 64; // px — 4rem, 1px ≈ 0.9375 minutes
const TIME_COL_W  = 52; // px for the time-label gutter
const MIN_EV_H    = 22; // minimum rendered event height

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
  singlePersonId?: string;
  hourHeight?: number;
}

interface Positioned {
  event: CalendarEvent;
  person: Person;
  startMin: number; // minutes from 00:00
  endMin:   number; // minutes from 00:00 (> startMin)
  lane:      number;
  totalLanes: number;
}

// Convert a UTC ISO string to minutes-from-midnight in the display timezone.
function tzMinutes(isoStr: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoStr));
  const h = Number(parts.find(p => p.type === 'hour')?.value   ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

// Greedy interval-scheduling lane assignment, then compute totalLanes per group.
function assignLanes(raw: Omit<Positioned, 'lane' | 'totalLanes'>[]): Positioned[] {
  const sorted = [...raw].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];

  const withLane = sorted.map(item => {
    let lane = laneEnds.findIndex(e => e <= item.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.endMin); }
    else laneEnds[lane] = item.endMin;
    return { ...item, lane };
  });

  // For each event find the max lane among all events it overlaps with.
  return withLane.map((item, i) => {
    let maxLane = item.lane;
    for (let j = 0; j < withLane.length; j++) {
      if (i === j) continue;
      const o = withLane[j];
      if (o.startMin < item.endMin && o.endMin > item.startMin) {
        maxLane = Math.max(maxLane, o.lane);
      }
    }
    return { ...item, totalLanes: maxLane + 1 };
  });
}

export default function SlotDayView({
  date, events, sources, people, t, locale, dateFormat, timezone, onEventClick, singlePersonId, hourHeight = DEFAULT_HOUR_HEIGHT,
}: SlotDayViewProps) {
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const PX_PER_MIN = hourHeight / 60;
  const TOTAL_H    = hourHeight * 24;

  const dayKey  = format(date, 'yyyy-MM-dd');
  const isToday = isSameDay(date, new Date());

  // Current time in display timezone, refreshed every minute.
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) { setNowMin(null); return; }
    const update = () => setNowMin(tzMinutes(new Date().toISOString(), timezone));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [isToday, timezone]);

  // Auto-scroll to current time (or 8 am) whenever the day changes.
  useEffect(() => {
    if (!scrollRef.current) return;
    const top = nowMin != null
      ? Math.max(0, nowMin * PX_PER_MIN - 120)
      : 8 * hourHeight - 8;
    scrollRef.current.scrollTop = top;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, hourHeight]);

  const activePerson = singlePersonId ?? filterPerson;
  const displayPeople = activePerson ? people.filter(p => p.id === activePerson) : people;

  const { allDayByPerson, positioned } = useMemo(() => {
    const allDay: Record<string, CalendarEvent[]> = {};
    const timed: Record<string, Omit<Positioned, 'lane' | 'totalLanes'>[]> = {};
    for (const p of displayPeople) { allDay[p.id] = []; timed[p.id] = []; }

    for (const ev of events) {
      const person = displayPeople.find(p => p.id === ev.person_id);
      if (!person) continue;
      const { startStr, endStr } = getEventDateRangeKeys(ev, timezone);
      if (dayKey < startStr || dayKey > endStr) continue;

      if (ev.all_day) { allDay[person.id].push(ev); continue; }

      const startMin = startStr === dayKey ? tzMinutes(ev.start_date, timezone) : 0;

      let endMin = 24 * 60; // default: spans to end of day
      if (endStr === dayKey && ev.end_date) {
        const raw = tzMinutes(ev.end_date, timezone);
        endMin = raw === 0 ? 24 * 60 : raw; // midnight end = 24:00
      } else if (!ev.end_date) {
        endMin = Math.min(startMin + 60, 24 * 60);
      }
      if (endMin <= startMin) endMin = startMin + 30;

      timed[person.id].push({ event: ev, person, startMin, endMin });
    }

    const posMap: Record<string, Positioned[]> = {};
    for (const [pid, items] of Object.entries(timed)) posMap[pid] = assignLanes(items);
    return { allDayByPerson: allDay, positioned: posMap };
  }, [events, displayPeople, timezone, dayKey]);

  const hasAllDay = displayPeople.some(p => (allDayByPerson[p.id]?.length ?? 0) > 0);
  const holiday   = getHoliday(locale, dayKey);
  const gridCols  = `${TIME_COL_W}px repeat(${Math.max(displayPeople.length, 1)}, minmax(0, 1fr))`;
  const hours     = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 select-none">

      {/* Person filter chips — hidden when a single person is pre-selected */}
      {people.length > 1 && !singlePersonId && (
        <div className="flex-shrink-0 flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700"
             style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterPerson(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${filterPerson === null
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {t.nav.all}
          </button>
          {people.map(person => (
            <button key={person.id}
              onClick={() => setFilterPerson(filterPerson === person.id ? null : person.id)}
              className="flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium border-2 transition-colors"
              style={filterPerson === person.id
                ? { backgroundColor: person.color, color: '#fff', borderColor: person.color }
                : { borderColor: person.color, color: person.color, backgroundColor: 'transparent' }}>
              {person.name}
            </button>
          ))}
        </div>
      )}

      {/* Column headers: date + person names */}
      <div className="flex-shrink-0 grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
           style={{ gridTemplateColumns: gridCols }}>
        {/* Date / holiday badge */}
        <div className="border-r border-gray-200 dark:border-gray-700 px-1 py-2 flex flex-col items-center justify-center gap-0.5">
          <span className={`text-base font-bold leading-none ${isToday ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
            {format(date, 'd')}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">
            {format(date, 'EEE')}
          </span>
        </div>
        {displayPeople.map(person => (
          <div key={person.id}
               className="px-2 py-2 text-sm font-semibold truncate border-r border-gray-200 dark:border-gray-700 last:border-r-0"
               style={{ color: person.color }}>
            {person.name}
          </div>
        ))}
      </div>

      {/* Holiday banner */}
      {holiday && (
        <div className="flex-shrink-0 px-4 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/40">
          {holiday}
        </div>
      )}

      {/* All-day row */}
      {hasAllDay && (
        <div className="flex-shrink-0 grid border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
             style={{ gridTemplateColumns: gridCols }}>
          <div className="border-r border-gray-200 dark:border-gray-700 px-1 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase text-right self-center">
            {t.calendar.allDay}
          </div>
          {displayPeople.map(person => (
            <div key={person.id} className="px-1 py-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 min-h-[2rem] space-y-0.5">
              {(allDayByPerson[person.id] ?? []).map(ev => (
                <button key={ev.id} onClick={() => onEventClick?.(ev)}
                  className="w-full text-left px-2 py-0.5 rounded text-xs font-medium text-white hover:opacity-90 truncate block"
                  style={{ backgroundColor: person.color }}>
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 24-hour scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: gridCols, height: TOTAL_H, position: 'relative' }}>

          {/* ── Time-label gutter ── */}
          <div className="relative border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
            {hours.map(h => (
              <div key={h} className="absolute right-0 w-full text-right pr-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 pointer-events-none"
                   style={{ top: h * hourHeight - 7, lineHeight: '1' }}>
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* ── One column per person ── */}
          {displayPeople.map(person => (
            <div key={person.id} className="relative border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                 style={{ height: TOTAL_H }}>

              {/* Hour dividers */}
              {hours.map(h => (
                <div key={h}
                     className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800 pointer-events-none"
                     style={{ top: h * hourHeight }} />
              ))}
              {/* Half-hour dashes */}
              {hours.map(h => (
                <div key={`h${h}`}
                     className="absolute left-4 right-0 border-t border-dashed border-gray-100 dark:border-gray-800/70 pointer-events-none"
                     style={{ top: h * hourHeight + hourHeight / 2 }} />
              ))}

              {/* Current-time red line */}
              {isToday && nowMin != null && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none"
                     style={{ top: Math.round(nowMin * PX_PER_MIN) }}>
                  <div className="absolute -left-0.5 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="h-[2px] bg-red-500 opacity-80" />
                </div>
              )}

              {/* Timed events */}
              {(positioned[person.id] ?? []).map(item => {
                const top    = item.startMin * PX_PER_MIN;
                const height = Math.max(MIN_EV_H, (item.endMin - item.startMin) * PX_PER_MIN);
                const pct    = 100 / item.totalLanes;
                const left   = item.lane * pct;
                const compact = height < 38;

                return (
                  <button key={item.event.id}
                    onClick={() => onEventClick?.(item.event)}
                    className="absolute rounded overflow-hidden text-left text-white hover:opacity-90 hover:z-30 focus:outline-none transition-opacity"
                    style={{
                      top:    `${top}px`,
                      height: `${height}px`,
                      left:   `calc(${left}% + 1px)`,
                      width:  `calc(${pct}% - 2px)`,
                      backgroundColor: person.color,
                      zIndex: 10,
                      padding: compact ? '1px 4px' : '3px 6px',
                    }}
                    title={[
                      item.event.title,
                      formatTzTime(item.event.start_date, timezone)
                        + (item.event.end_date ? ` – ${formatTzTime(item.event.end_date, timezone)}` : ''),
                      item.event.location ?? '',
                    ].filter(Boolean).join('\n')}
                  >
                    <p className={`font-semibold leading-tight truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                      {item.event.title}
                    </p>
                    {!compact && (
                      <p className="text-[10px] opacity-90 leading-tight mt-px">
                        {formatTzTime(item.event.start_date, timezone)}
                        {item.event.end_date && ` – ${formatTzTime(item.event.end_date, timezone)}`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
