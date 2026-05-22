import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
} from 'date-fns';
import { getPeople, getSettings, getEvents } from '@/lib/db';
import { getLocaleData, getMonthName } from '@/lib/i18n';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';
import type { CalendarEvent, Person } from '@/types';
import PrintControls from './PrintControls';

export const dynamic = 'force-dynamic';

const MAX_SINGLE = 5;
const BAR_H = 14; // px per multi-day lane row

function personColor(personId: string, people: Person[]): string {
  return people.find(p => p.id === personId)?.color ?? '#6366f1';
}

function dayOffset(fromStr: string, toStr: string): number {
  return Math.round(
    (new Date(toStr + 'T00:00:00').getTime() - new Date(fromStr + 'T00:00:00').getTime()) / 86400000,
  );
}

type MultiDayRaw = { event: CalendarEvent; startStr: string; endStr: string };

// One bar per unique (title, startStr, endStr) — merges same event across people
type UnifiedBar = {
  id: string;           // representative event id (for lane map)
  title: string;
  startStr: string;
  endStr: string;
  colors: string[];     // one per person, in display_order
};

function buildUnified(entries: MultiDayRaw[], people: Person[]): UnifiedBar[] {
  const groups = new Map<string, MultiDayRaw[]>();
  for (const e of entries) {
    const key = `${e.event.title}\x00${e.startStr}\x00${e.endStr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return Array.from(groups.values()).map(grp => {
    // Sort by person display_order for consistent dot order
    grp.sort((a, b) => {
      const oa = people.find(p => p.id === a.event.person_id)?.display_order ?? 99;
      const ob = people.find(p => p.id === b.event.person_id)?.display_order ?? 99;
      return oa - ob;
    });
    return {
      id: grp[0].event.id,
      title: grp[0].event.title,
      startStr: grp[0].startStr,
      endStr: grp[0].endStr,
      colors: grp.map(e => personColor(e.event.person_id, people)),
    };
  });
}

// Greedy lane assignment — no ical_uid grouping, each bar is independent
function assignLanes(bars: Array<{ id: string; startStr: string; endStr: string }>): Map<string, number> {
  const lanes = new Map<string, number>();
  const sorted = [...bars].sort((a, b) => a.startStr.localeCompare(b.startStr));
  const laneEnds: string[] = [];
  for (const { id, startStr, endStr } of sorted) {
    let lane = laneEnds.findIndex(e => e < startStr);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(endStr); }
    else { laneEnds[lane] = endStr; }
    lanes.set(id, lane);
  }
  return lanes;
}

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function PrintPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const settings = getSettings();
  const locale   = settings.locale || 'en';
  const timezone = settings.display_timezone || 'Europe/Oslo';
  const appName  = settings.app_name || 'Family Calendar';
  const t        = getLocaleData(locale);
  const people   = getPeople() as Person[];

  let monthDate: Date;
  try {
    const parts = (params.month ?? '').split('-').map(Number);
    monthDate = parts[0] && parts[1] ? new Date(parts[0], parts[1] - 1, 1) : new Date();
  } catch {
    monthDate = new Date();
  }
  monthDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

  const monthStart = startOfMonth(monthDate);
  const monthEnd   = endOfMonth(monthDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const rawEvents = getEvents(gridStart.toISOString(), gridEnd.toISOString()) as CalendarEvent[];

  // Split into multi-day (span > 1 day in the display timezone) and single-day buckets
  const rawMultiDay: MultiDayRaw[] = [];
  const singleByDay: Record<string, CalendarEvent[]> = {};

  for (const event of rawEvents) {
    const { startStr, endStr } = getEventDateRangeKeys(event, timezone);
    if (startStr !== endStr) {
      rawMultiDay.push({ event, startStr, endStr });
    } else {
      (singleByDay[startStr] ??= []).push(event);
    }
  }

  // Merge identical events across people into one bar each
  const unifiedBars = buildUnified(rawMultiDay, people);

  // Group days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthName    = getMonthName(locale, monthDate.getMonth());
  const title        = `${monthName} ${monthDate.getFullYear()}`;
  const currentMonth = format(monthDate, 'yyyy-MM');
  const prevMonth    = format(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1), 'yyyy-MM');
  const nextMonth    = format(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1), 'yyyy-MM');

  const dayHeaders = [
    t.days.short.monday, t.days.short.tuesday, t.days.short.wednesday,
    t.days.short.thursday, t.days.short.friday, t.days.short.saturday, t.days.short.sunday,
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @page { margin: 10mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>

      <PrintControls title={title} prevMonth={prevMonth} nextMonth={nextMonth} currentMonth={currentMonth} />

      <div className="p-4 print:p-0">
        {/* Print-only title */}
        <div className="hidden print:flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">{title}</h1>
          <span className="text-xs text-gray-400">{appName}</span>
        </div>

        <div className="border-l border-t border-gray-300 text-[10px]">

          {/* Day-of-week header */}
          <div className="grid grid-cols-7">
            {dayHeaders.map(d => (
              <div key={d} className="border-r border-b border-gray-300 py-1 text-center font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((weekDays, wi) => {
            const weekStartStr = format(weekDays[0], 'yyyy-MM-dd');
            const weekEndStr   = format(weekDays[6], 'yyyy-MM-dd');

            // Unified bars active this week, clamped to week bounds
            const weekBars = unifiedBars
              .filter(b => b.startStr <= weekEndStr && b.endStr >= weekStartStr)
              .map(b => ({
                ...b,
                clampedStart: b.startStr < weekStartStr ? weekStartStr : b.startStr,
                clampedEnd:   b.endStr   > weekEndStr   ? weekEndStr   : b.endStr,
              }));

            const laneMap    = assignLanes(weekBars.map(b => ({ id: b.id, startStr: b.clampedStart, endStr: b.clampedEnd })));
            const totalLanes = weekBars.length > 0
              ? Math.max(...weekBars.map(b => laneMap.get(b.id) ?? 0)) + 1
              : 0;

            return (
              <div key={wi} className="border-b border-gray-300">

                {/* Day-number strip */}
                <div className="grid grid-cols-7">
                  {weekDays.map(day => {
                    const inMonth = isSameMonth(day, monthDate);
                    const today   = isToday(day);
                    const weekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div
                        key={format(day, 'yyyy-MM-dd')}
                        className={`border-r border-gray-300 px-1 pt-0.5 flex justify-end
                          ${!inMonth ? 'bg-gray-50' : weekend ? 'bg-sky-50/40' : 'bg-white'}`}
                        style={{ minHeight: 18 }}
                      >
                        <span className={`text-[11px] font-semibold leading-5 w-5 text-center rounded-full
                          ${today ? 'bg-blue-500 text-white' : inMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Multi-day spanning bars */}
                {totalLanes > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0,1fr))',
                      gridTemplateRows: `repeat(${totalLanes}, ${BAR_H}px)`,
                      rowGap: 1,
                      padding: '1px 0 2px',
                    }}
                  >
                    {weekBars.map(bar => {
                      const col1    = dayOffset(weekStartStr, bar.clampedStart) + 1;
                      const col2    = dayOffset(weekStartStr, bar.clampedEnd)   + 1;
                      const lane    = (laneMap.get(bar.id) ?? 0) + 1;
                      const isStart = bar.startStr >= weekStartStr;
                      const primary = bar.colors[0] ?? '#6366f1';

                      return (
                        <div
                          key={bar.id}
                          style={{
                            gridColumn: `${col1} / ${col2 + 1}`,
                            gridRow: lane,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            paddingLeft: isStart ? 3 : 1,
                            paddingRight: 3,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            backgroundColor: `${primary}22`,
                            borderLeft: isStart ? `3px solid ${primary}` : `1px solid ${primary}66`,
                            borderRadius: isStart ? '2px 0 0 2px' : 0,
                            lineHeight: `${BAR_H}px`,
                          }}
                        >
                          {/* Per-person color dots (only at bar start) */}
                          {isStart && bar.colors.length > 1 && (
                            <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                              {bar.colors.map((c, i) => (
                                <span
                                  key={i}
                                  style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c, display: 'inline-block', flexShrink: 0 }}
                                />
                              ))}
                            </span>
                          )}
                          {/* Event title */}
                          <span style={{ fontSize: 9, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isStart ? bar.title : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Single-day events */}
                <div className="grid grid-cols-7" style={{ minHeight: 52 }}>
                  {weekDays.map(day => {
                    const key      = format(day, 'yyyy-MM-dd');
                    const evts     = (singleByDay[key] ?? []).sort((a, b) => a.start_date.localeCompare(b.start_date));
                    const inMonth  = isSameMonth(day, monthDate);
                    const weekend  = day.getDay() === 0 || day.getDay() === 6;
                    const overflow = evts.length > MAX_SINGLE;
                    const shown    = evts.slice(0, MAX_SINGLE);
                    return (
                      <div
                        key={key}
                        className={`border-r border-gray-300 px-0.5 pb-0.5 space-y-px
                          ${!inMonth ? 'bg-gray-50' : weekend ? 'bg-sky-50/40' : 'bg-white'}`}
                      >
                        {shown.map((event, i) => {
                          const color   = personColor(event.person_id, people);
                          const timeStr = formatTzTime(event.start_date, timezone);
                          return (
                            <div
                              key={`${event.id}-${i}`}
                              className="overflow-hidden rounded-sm"
                              style={{ borderLeft: `2px solid ${color}`, backgroundColor: `${color}1A` }}
                            >
                              <span className="block truncate leading-[13px] px-0.5 text-gray-900">
                                {timeStr && <span className="text-gray-500 mr-0.5">{timeStr}</span>}
                                {event.title}
                              </span>
                            </div>
                          );
                        })}
                        {overflow && (
                          <div className="text-[9px] text-gray-400 pl-0.5 leading-[13px]">
                            +{evts.length - MAX_SINGLE} more
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>

        {/* Legend */}
        {people.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {people.map(p => (
              <div key={p.id} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[10px] text-gray-600">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
