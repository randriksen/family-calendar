import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, getISOWeek,
  isValid, parseISO, startOfMonth, startOfWeek,
} from 'date-fns';
import type { CalendarEvent, CalendarSource, LocaleData, Person } from '@/types';
import { getEventDateRangeKeys, toTzDateStr } from '@/lib/tz';
import { getDayNames, getLocaleData, getMonthName } from '@/lib/i18n';
import { assignLanes, buildDayData, fmtMin } from '@/lib/schedule';

// Lite mode: one month, week or day at a time, rendered as plain HTML for
// weak or old devices. Everything here is pure data preparation; LitePage
// turns the model into markup and the route handler loads the inputs.

export type LiteView = 'month' | 'week' | 'day' | 'schedule' | 'dayplan';
export const LITE_VIEWS: LiteView[] = ['month', 'week', 'day', 'schedule', 'dayplan'];

export interface LiteDay {
  key: string;        // YYYY-MM-DD in the display timezone
  dayOfMonth: number;
  weekday: number;    // 0 = Monday … 6 = Sunday
  inMonth: boolean;   // false for padding days in the month grid
}

export interface LiteWeek {
  weekNumber: number;
  days: LiteDay[];
}

export interface LiteLink {
  label: string;
  href: string;
  active: boolean;
  color?: string;
}

// Schedule (timeplan) view: seven days from the chosen date, each a time grid
// with one column per person. The day plan is the same grid for a single day,
// with that day's all-day events above it. Geometry is computed here so the
// page only has to place absolutely positioned blocks.
export interface LiteScheduleBlock {
  ev: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  time: string;
  compact: boolean;   // too short to show more than the title
}

export interface LiteScheduleDay {
  key: string;
  dayName: string;
  dayOfMonth: number;
  hasEvents: boolean;
  columns: LiteScheduleBlock[][];   // one per person, same order as people
  allDay: CalendarEvent[][];        // one per person; only filled for the day plan
}

export interface LiteSchedule {
  people: Person[];
  days: LiteScheduleDay[];
  hourHeight: number;
  totalH: number;
  hours: { label: string; y: number }[];
}

export interface LiteModel {
  view: LiteView;
  schedule: LiteSchedule | null;
  dateKey: string;
  todayKey: string;
  title: string;
  weeks: LiteWeek[];
  days: LiteDay[];
  eventsByDay: Record<string, CalendarEvent[]>;
  people: Person[];
  sources: CalendarSource[];
  timezone: string;
  locale: string;
  t: LocaleData;
  appName: string;
  dayNamesShort: string[];
  dayNamesLong: string[];
  refreshSeconds: number;
  maxPerCell: number;
  nav: {
    views: LiteLink[];
    prev: string;
    today: string;
    next: string;
    people: LiteLink[];
  };
  dayHref: (key: string) => string;
}

export interface LiteParams {
  view: LiteView;
  dateKey: string;
  personId: string | null;
  refreshSeconds: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseLiteParams(
  searchParams: URLSearchParams,
  opts: { todayKey: string; defaultView: string; peopleIds: string[] },
): LiteParams {
  const rawView = searchParams.get('view') || opts.defaultView;
  const view: LiteView = (LITE_VIEWS as string[]).includes(rawView) ? (rawView as LiteView) : 'month';

  const rawDate = searchParams.get('date') || '';
  const dateKey = DATE_RE.test(rawDate) && isValid(parseISO(rawDate)) ? rawDate : opts.todayKey;

  const rawPerson = searchParams.get('person');
  const personId = rawPerson && opts.peopleIds.includes(rawPerson) ? rawPerson : null;

  // 0 disables the meta refresh; otherwise keep it sane for a wall display.
  const rawRefresh = parseInt(searchParams.get('refresh') ?? '300', 10);
  const refreshSeconds = Number.isFinite(rawRefresh)
    ? (rawRefresh <= 0 ? 0 : Math.min(3600, Math.max(30, rawRefresh)))
    : 300;

  return { view, dateKey, personId, refreshSeconds };
}

export function liteHref(p: { view: LiteView; dateKey: string; personId: string | null; refreshSeconds: number }): string {
  const q = new URLSearchParams();
  q.set('view', p.view);
  q.set('date', p.dateKey);
  if (p.personId) q.set('person', p.personId);
  if (p.refreshSeconds !== 300) q.set('refresh', String(p.refreshSeconds));
  return `/lite?${q.toString()}`;
}

// The span of days a view needs, as YYYY-MM-DD keys. The month grid is padded
// to whole Monday-start weeks so it lines up like the main app.
export function liteDateSpan(view: LiteView, dateKey: string): { start: Date; end: Date } {
  const d = parseISO(dateKey);
  switch (view) {
    case 'month':
      return {
        start: startOfWeek(startOfMonth(d), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(d), { weekStartsOn: 1 }),
      };
    case 'week':
      return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
    case 'day':
    case 'dayplan':
      return { start: d, end: d };
    case 'schedule':
      return { start: d, end: addDays(d, 6) };
  }
}

function toDay(d: Date, monthIndex: number): LiteDay {
  return {
    key: format(d, 'yyyy-MM-dd'),
    dayOfMonth: d.getDate(),
    weekday: (d.getDay() + 6) % 7,
    inMonth: d.getMonth() === monthIndex,
  };
}

function bucketEvents(events: CalendarEvent[], dayKeys: Set<string>, tz: string): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const { startStr, endStr } = getEventDateRangeKeys(ev, tz);
    let cur = parseISO(startStr);
    const end = parseISO(endStr);
    if (!isValid(cur) || !isValid(end)) continue;
    // Guard against pathological multi-year spans blowing up the loop.
    for (let i = 0; cur <= end && i < 400; i++) {
      const key = format(cur, 'yyyy-MM-dd');
      if (dayKeys.has(key)) (out[key] ||= []).push(ev);
      cur = addDays(cur, 1);
    }
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => (b.all_day - a.all_day) || a.start_date.localeCompare(b.start_date));
  }
  return out;
}

function shift(view: LiteView, dateKey: string, dir: -1 | 1): string {
  const d = parseISO(dateKey);
  // Day and schedule both step one day, like the main app.
  const moved = view === 'month' ? addMonths(d, dir) : view === 'week' ? addWeeks(d, dir) : addDays(d, dir);
  return format(moved, 'yyyy-MM-dd');
}

const SCHEDULE_HOUR_HEIGHT = 56;
const SCHEDULE_MIN_BLOCK = 20;

function buildSchedule(
  days: LiteDay[], events: CalendarEvent[], people: Person[], dayNames: string[], tz: string,
  eventsByDay: Record<string, CalendarEvent[]>, withAllDay: boolean,
): LiteSchedule {
  const dayData = days.map(d => buildDayData(d.key, events, people, tz));
  const spans = dayData.flatMap(dd => Array.from(dd.spansByPerson.values()).flat());

  // Global time axis across the week, snapped to whole hours so the hour
  // lines start at the top of the grid.
  const gMin = spans.length ? Math.min(...spans.map(s => s.startMin)) : 8 * 60;
  const gMax = spans.length ? Math.max(...spans.map(s => s.endMin)) : 18 * 60;
  const axisStart = Math.floor(gMin / 60) * 60;
  const axisEnd = Math.max(axisStart + 60, Math.ceil(gMax / 60) * 60);
  const pxPerMin = SCHEDULE_HOUR_HEIGHT / 60;
  const totalH = (axisEnd - axisStart) * pxPerMin;

  const hours: { label: string; y: number }[] = [];
  for (let h = axisStart; h < axisEnd; h += 60) hours.push({ label: fmtMin(h), y: (h - axisStart) * pxPerMin });

  return {
    people,
    hourHeight: SCHEDULE_HOUR_HEIGHT,
    totalH,
    hours,
    days: days.map((d, i) => {
      const dd = dayData[i];
      return {
        key: d.key,
        dayName: dayNames[d.weekday],
        dayOfMonth: d.dayOfMonth,
        hasEvents: dd.hasEvents,
        allDay: people.map(p => withAllDay ? (eventsByDay[d.key] || []).filter(ev => ev.all_day && ev.person_id === p.id) : []),
        columns: people.map(p => assignLanes(dd.spansByPerson.get(p.id) ?? []).map(item => {
          const top = (item.startMin - axisStart) * pxPerMin;
          const height = Math.max(SCHEDULE_MIN_BLOCK, (item.endMin - item.startMin) * pxPerMin);
          return {
            ev: item.event,
            top,
            height,
            leftPct: (item.lane / item.totalLanes) * 100,
            widthPct: (1 / item.totalLanes) * 100,
            time: `${fmtMin(item.startMin)}–${fmtMin(item.endMin)}`,
            compact: height < 30,
          };
        })),
      };
    }),
  };
}

export function buildLiteModel(input: {
  params: LiteParams;
  events: CalendarEvent[];
  people: Person[];
  sources: CalendarSource[];
  settings: Record<string, string>;
}): LiteModel {
  const { params, events, people, sources, settings } = input;
  const { view, dateKey, personId, refreshSeconds } = params;

  const timezone = settings.display_timezone || 'Europe/Oslo';
  const locale = settings.locale || 'en';
  const t = getLocaleData(locale);
  const appName = settings.app_name || t.app.name;
  const todayKey = toTzDateStr(new Date(), timezone);

  const focus = parseISO(dateKey);
  const monthIndex = focus.getMonth();
  const { start, end } = liteDateSpan(view, dateKey);

  const days: LiteDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(toDay(d, monthIndex));

  const weeks: LiteWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({ weekNumber: getISOWeek(parseISO(chunk[0].key)), days: chunk });
  }

  const eventsByDay = bucketEvents(events, new Set(days.map(d => d.key)), timezone);

  const dayNamesShort = getDayNames(locale, true);
  const dayNamesLong = getDayNames(locale, false);
  const monthName = getMonthName(locale, monthIndex);

  let title: string;
  if (view === 'month') {
    title = `${monthName} ${focus.getFullYear()}`;
  } else if (view === 'week') {
    const w = getISOWeek(focus);
    title = `${t.calendar.weekNumber} ${w} · ${format(start, 'dd.MM')} – ${format(end, 'dd.MM.yyyy')}`;
  } else if (view === 'schedule') {
    title = `${t.views.schedule} · ${format(start, 'dd.MM')} – ${format(end, 'dd.MM.yyyy')}`;
  } else {
    title = `${dayNamesLong[(focus.getDay() + 6) % 7]} ${focus.getDate()}. ${monthName} ${focus.getFullYear()}`;
  }

  const schedulePeople = personId ? people.filter(p => p.id === personId) : people;
  const schedule = view === 'schedule' || view === 'dayplan'
    ? buildSchedule(days, events, schedulePeople, dayNamesShort, timezone, eventsByDay, view === 'dayplan')
    : null;

  const link = (over: Partial<LiteParams>) => liteHref({ view, dateKey, personId, refreshSeconds, ...over });

  const viewLabels: Record<LiteView, string> = {
    month: t.views.month, week: t.views.week, day: t.views.day, schedule: t.views.schedule, dayplan: t.views.dayplan,
  };

  return {
    view, schedule, dateKey, todayKey, title, weeks, days, eventsByDay, people, sources,
    timezone, locale, t, appName, dayNamesShort, dayNamesLong, refreshSeconds,
    maxPerCell: 4,
    nav: {
      views: LITE_VIEWS.map(v => ({ label: viewLabels[v], href: link({ view: v }), active: v === view })),
      prev: link({ dateKey: shift(view, dateKey, -1) }),
      today: link({ dateKey: todayKey }),
      next: link({ dateKey: shift(view, dateKey, 1) }),
      people: [
        { label: t.nav.all, href: link({ personId: null }), active: personId === null },
        ...people.map(p => ({ label: p.name, href: link({ personId: p.id }), active: personId === p.id, color: p.color })),
      ],
    },
    dayHref: (key: string) => link({ view: 'day', dateKey: key }),
  };
}
