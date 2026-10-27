'use client';

import { useState, useMemo } from 'react';
import { addDays, format, isToday } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';

type CropMode = 'global' | 'per-day';
type GapMode  = 'kept'   | 'collapsed';

const DEFAULT_HOUR_HEIGHT = 64;

// ── Timezone ──────────────────────────────────────────────────────────────────

function tzMinutes(isoStr: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoStr));
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0) * 60
       + Number(parts.find(p => p.type === 'minute')?.value ?? 0);
}

// ── Interval helpers ──────────────────────────────────────────────────────────

interface Interval { start: number; end: number; }

function mergeIntervals(ivs: Interval[]): Interval[] {
  if (!ivs.length) return [];
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (const iv of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

// ── Vertical time map ─────────────────────────────────────────────────────────

interface GapBar { y: number; durationMin: number; }

interface TimeMapV {
  timeToY  : (min: number) => number;
  totalH   : number;
  hourLines: number[];   // minute values for hour grid lines
  gapBars  : GapBar[];  // horizontal gap indicator strips
}

function buildKeptMapV(minMin: number, maxMin: number, pxPerMin: number): TimeMapV {
  const range = Math.max(30, maxMin - minMin);
  const hourLines: number[] = [];
  for (let h = Math.ceil(minMin / 60) * 60; h < maxMin; h += 60) hourLines.push(h);
  return {
    timeToY : (min) => (min - minMin) * pxPerMin,
    totalH  : range * pxPerMin,
    hourLines,
    gapBars : [],
  };
}

function buildCollapsedMapV(
  spans: Array<{ startMin: number; endMin: number }>,
  pxPerMin: number,
  gapBarH: number,
): TimeMapV {
  if (!spans.length) return buildKeptMapV(8 * 60, 18 * 60, pxPerMin);
  const padded   = spans.map(s => ({ start: Math.max(0, s.startMin - 3), end: Math.min(1440, s.endMin + 3) }));
  const occupied  = mergeIntervals(padded);

  let offset = 0;
  const segY: number[] = [];
  const gapBars: GapBar[] = [];

  for (let i = 0; i < occupied.length; i++) {
    segY.push(offset);
    offset += (occupied[i].end - occupied[i].start) * pxPerMin;
    if (i < occupied.length - 1) {
      gapBars.push({ y: offset, durationMin: occupied[i + 1].start - occupied[i].end });
      offset += gapBarH;
    }
  }
  const totalH = offset;

  const timeToY = (min: number): number => {
    for (let i = 0; i < occupied.length; i++) {
      if (min <= occupied[i].start) return segY[i];
      if (min < occupied[i].end)   return segY[i] + (min - occupied[i].start) * pxPerMin;
    }
    return totalH;
  };

  return { timeToY, totalH, hourLines: [], gapBars };
}

// ── Lane assignment ───────────────────────────────────────────────────────────

interface Span { event: CalendarEvent; startMin: number; endMin: number; }
interface PosSpan extends Span { lane: number; totalLanes: number; }

function assignLanes(spans: Span[]): PosSpan[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];
  const withLane = sorted.map(item => {
    let lane = laneEnds.findIndex(e => e <= item.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.endMin); }
    else laneEnds[lane] = item.endMin;
    return { ...item, lane };
  });
  return withLane.map(item => {
    let max = item.lane;
    for (const o of withLane)
      if (o.startMin < item.endMin && o.endMin > item.startMin) max = Math.max(max, o.lane);
    return { ...item, totalLanes: max + 1 };
  });
}

// ── Day data ──────────────────────────────────────────────────────────────────

interface DayData {
  day          : Date;
  dayKey       : string;
  spansByPerson: Map<string, Span[]>;
  allMin       : number;
  allMax       : number;
  hasEvents    : boolean;
}

function buildDayData(day: Date, events: CalendarEvent[], people: Person[], tz: string): DayData {
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(day);
  const spansByPerson = new Map<string, Span[]>(people.map(p => [p.id, []]));
  let allMin = Infinity, allMax = -Infinity;

  for (const ev of events) {
    if (ev.all_day || !ev.person_id || !spansByPerson.has(ev.person_id)) continue;
    const { startStr, endStr } = getEventDateRangeKeys(ev, tz);
    if (dayKey < startStr || dayKey > endStr) continue;
    const startMin = startStr === dayKey ? tzMinutes(ev.start_date, tz) : 0;
    const rawEnd   = endStr === dayKey && ev.end_date ? tzMinutes(ev.end_date, tz) : 24 * 60;
    const endMin   = Math.max(startMin + 15, rawEnd);
    spansByPerson.get(ev.person_id)!.push({ event: ev, startMin, endMin });
    if (startMin < allMin) allMin = startMin;
    if (endMin   > allMax) allMax = endMin;
  }

  const hasEvents = allMin !== Infinity;
  if (!hasEvents) { allMin = 8 * 60; allMax = 18 * 60; }
  return { day, dayKey, spansByPerson, allMin, allMax, hasEvents };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')          // strip HTML tags
    .replace(/https?:\/\/\S+/g, '')    // remove URLs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function fmtGap(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;
type DayKey = typeof DAY_KEYS[number];

// ── Component ─────────────────────────────────────────────────────────────────

interface ScheduleViewProps {
  date          : Date;
  events        : CalendarEvent[];
  sources       : CalendarSource[];
  people        : Person[];
  t             : LocaleData;
  locale        : string;
  timezone      : string;
  hourHeight?   : number;
  onEventClick? : (event: CalendarEvent) => void;
  singlePersonId?: string;
}

export default function ScheduleView({
  date, events, people, t, timezone, hourHeight = DEFAULT_HOUR_HEIGHT,
  onEventClick, singlePersonId,
}: ScheduleViewProps) {
  const [cropMode, setCropMode] = useState<CropMode>('global');
  const [gapMode,  setGapMode]  = useState<GapMode>('kept');

  // All sizing scales with hourHeight so the view is legible at any screen size.
  const pxPerMin   = hourHeight / 60;
  const gapBarH    = Math.round(24 * hourHeight / DEFAULT_HOUR_HEIGHT);
  const minEvH     = Math.round(20 * hourHeight / DEFAULT_HOUR_HEIGHT);
  const timeColW   = Math.round(44 * hourHeight / DEFAULT_HOUR_HEIGHT);
  const large      = hourHeight >= 80;   // 2xl breakpoint or display screen
  const titleSize  = large ? Math.round(12 * hourHeight / DEFAULT_HOUR_HEIGHT) : 12;
  const subSize    = large ? Math.round(10 * hourHeight / DEFAULT_HOUR_HEIGHT) : 10;
  // Content tier thresholds scale with hourHeight
  const tierTime   = 30  * hourHeight / DEFAULT_HOUR_HEIGHT;
  const tierLoc    = 54  * hourHeight / DEFAULT_HOUR_HEIGHT;
  const tierDesc   = 80  * hourHeight / DEFAULT_HOUR_HEIGHT;

  const displayPeople = singlePersonId
    ? people.filter(p => p.id === singlePersonId)
    : people;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(date, i)),
    [date],
  );

  const dayDataList = useMemo(
    () => weekDays.map(d => buildDayData(d, events, displayPeople, timezone)),
    [weekDays, events, displayPeople, timezone],
  );

  const maps = useMemo((): TimeMapV[] => {
    if (cropMode === 'global') {
      const allSpans = dayDataList.flatMap(dd => Array.from(dd.spansByPerson.values()).flat());
      const gMin = allSpans.length ? Math.min(...allSpans.map(s => s.startMin)) : 8 * 60;
      const gMax = allSpans.length ? Math.max(...allSpans.map(s => s.endMin))   : 18 * 60;
      const map  = gapMode === 'kept'
        ? buildKeptMapV(gMin, gMax, pxPerMin)
        : buildCollapsedMapV(allSpans, pxPerMin, gapBarH);
      return dayDataList.map(() => map);
    } else {
      return dayDataList.map(dd => {
        const spans = Array.from(dd.spansByPerson.values()).flat();
        return gapMode === 'kept'
          ? buildKeptMapV(dd.allMin, dd.allMax, pxPerMin)
          : (spans.length
              ? buildCollapsedMapV(spans, pxPerMin, gapBarH)
              : buildKeptMapV(dd.allMin, dd.allMax, pxPerMin));
      });
    }
  }, [cropMode, gapMode, dayDataList, pxPerMin, gapBarH]);

  const isGlobal = cropMode === 'global';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900 select-none">

      {/* ── Toggles ── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-semibold text-gray-500 dark:text-gray-400">
          {format(weekDays[0], 'd MMM')} – {format(weekDays[6], 'd MMM')}
        </span>

        <div className="flex items-center gap-1.5">
          <span>Time axis:</span>
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
            {(['global','per-day'] as CropMode[]).map(m => (
              <button key={m} onClick={() => setCropMode(m)}
                className={`px-2.5 py-0.5 transition-colors ${cropMode === m ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {m === 'global' ? 'Global' : 'Per day'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span>Gaps:</span>
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
            {(['kept','collapsed'] as GapMode[]).map(m => (
              <button key={m} onClick={() => setGapMode(m)}
                className={`px-2.5 py-0.5 transition-colors ${gapMode === m ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {m === 'kept' ? 'Kept' : 'Collapsed'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-auto">

        {/* Sticky person header */}
        <div className="sticky top-0 z-20 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          {/* Corner: aligns with time column */}
          <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-700"
            style={{ width: timeColW }} />
          {/* Person columns */}
          {displayPeople.map((person, pi) => (
            <div key={person.id}
              className={`flex-1 flex items-center gap-2 min-w-0 ${pi > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''}`}
              style={{ borderTopColor: person.color, borderTopWidth: large ? 3 : 2, padding: large ? '10px 12px' : '6px 8px' }}>
              {person.photo_url
                ? <img src={person.photo_url} alt={person.name} className="rounded-full object-cover flex-shrink-0"
                    style={{ width: large ? 28 : 20, height: large ? 28 : 20 }} />
                : <div className="rounded-full flex-shrink-0"
                    style={{ width: large ? 12 : 10, height: large ? 12 : 10, backgroundColor: person.color }} />
              }
              <span className="font-semibold truncate" style={{ color: person.color, fontSize: large ? 15 : 12 }}>
                {person.name}
              </span>
            </div>
          ))}
        </div>

        {/* Day sections */}
        {dayDataList.map((dd, di) => {
          const today = isToday(dd.day);
          const map   = maps[di];

          return (
            <div key={dd.dayKey} className={today ? 'bg-blue-50/10 dark:bg-blue-950/5' : ''}>

              {/* Day separator */}
              <div className={`flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 ${today ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-gray-50 dark:bg-gray-800/40'}`}
                style={{ padding: large ? '8px 16px' : '4px 12px' }}>
                <span className="font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                  style={{ fontSize: large ? 13 : 10 }}>
                  {t.days.short[DAY_KEYS[dd.day.getDay()] as DayKey]}
                </span>
                <span className={`font-bold leading-none ${today ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}
                  style={{ fontSize: large ? 28 : 18 }}>
                  {dd.day.getDate()}
                </span>
                {!isGlobal && dd.hasEvents && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1" style={{ fontSize: large ? 12 : 10 }}>
                    {fmtMin(dd.allMin)} – {fmtMin(dd.allMax)}
                  </span>
                )}
                {!dd.hasEvents && (
                  <span className="text-gray-300 dark:text-gray-600 ml-1 italic" style={{ fontSize: large ? 12 : 10 }}>no events</span>
                )}
              </div>

              {/* Time + event content */}
              <div className="flex" style={{ height: map.totalH }}>

                {/* Time label column */}
                <div className="flex-shrink-0 relative border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40"
                  style={{ width: timeColW }}>
                  {map.hourLines.map(min => (
                    <div key={min}
                      className="absolute right-1 text-gray-400 dark:text-gray-500 leading-none pointer-events-none"
                      style={{ top: map.timeToY(min) - (large ? 8 : 6), fontSize: large ? 13 : 10 }}>
                      {fmtMin(min)}
                    </div>
                  ))}
                </div>

                {/* Events area */}
                <div className="flex-1 relative">

                  {/* Hour grid lines */}
                  {map.hourLines.map(min => (
                    <div key={min}
                      className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800 pointer-events-none"
                      style={{ top: map.timeToY(min) }} />
                  ))}

                  {/* Gap bars (collapsed mode) */}
                  {map.gapBars.map((bar, bi) => (
                    <div key={bi}
                      className="absolute left-0 right-0 flex items-center gap-1 z-10 pointer-events-none"
                      style={{ top: bar.y, height: gapBarH }}>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                        {fmtGap(bar.durationMin)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  ))}

                  {/* Person columns */}
                  <div className="absolute inset-0 flex">
                    {displayPeople.map((person, pi) => {
                      const spans      = dd.spansByPerson.get(person.id) ?? [];
                      const positioned = assignLanes(spans);

                      return (
                        <div key={person.id}
                          className={`relative flex-1 ${pi > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}>
                          {positioned.map(item => {
                            const top    = map.timeToY(item.startMin);
                            const bottom = map.timeToY(item.endMin);
                            const height = Math.max(minEvH, bottom - top);
                            const leftPct  = (item.lane / item.totalLanes) * 100;
                            const widthPct = (1 / item.totalLanes) * 100;

                            // Content tiers scale with hourHeight
                            const tiny     = height < tierTime;
                            const showTime = height >= tierTime;
                            const showLoc  = height >= tierLoc && !!item.event.location;
                            const showDesc = height >= tierDesc && !!item.event.description;

                            const timeStr = formatTzTime(item.event.start_date, timezone)
                              + (item.event.end_date ? `–${formatTzTime(item.event.end_date, timezone)}` : '');
                            const desc = showDesc ? cleanDescription(item.event.description) : '';

                            const tooltip = [
                              item.event.title,
                              timeStr,
                              item.event.location ?? '',
                              desc,
                            ].filter(Boolean).join('\n');

                            return (
                              <div key={item.event.id}
                                className="absolute rounded overflow-hidden cursor-pointer hover:opacity-90 active:opacity-75 transition-opacity"
                                style={{
                                  top, height,
                                  left  : `calc(${leftPct}% + 1px)`,
                                  width : `calc(${widthPct}% - 2px)`,
                                  backgroundColor: person.color,
                                  padding: tiny ? '1px 4px' : '3px 6px',
                                }}
                                title={tooltip}
                                onClick={() => onEventClick?.(item.event)}>

                                {/* Title */}
                                <div className="text-white font-semibold truncate leading-tight"
                                  style={{ fontSize: tiny ? Math.max(9, titleSize - 2) : titleSize }}>
                                  {item.event.title}
                                </div>

                                {/* Time */}
                                {showTime && (
                                  <div className="text-white/75 truncate leading-tight mt-px" style={{ fontSize: subSize }}>
                                    {timeStr}
                                  </div>
                                )}

                                {/* Location */}
                                {showLoc && (
                                  <div className="flex items-start gap-0.5 mt-0.5 min-w-0">
                                    <svg className="flex-shrink-0 mt-px" width={subSize} height={subSize} viewBox="0 0 24 24" fill="white" fillOpacity={0.75}>
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    <span className="text-white/75 truncate leading-tight" style={{ fontSize: subSize }}>
                                      {item.event.location}
                                    </span>
                                  </div>
                                )}

                                {/* Description */}
                                {showDesc && desc && (
                                  <div className="text-white/60 leading-snug mt-1 overflow-hidden"
                                    style={{ fontSize: subSize, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                    {desc}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
