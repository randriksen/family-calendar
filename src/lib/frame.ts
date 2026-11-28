import { addDays, format, getISOWeek, parseISO } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person } from '@/types';
import { getEventColor } from '@/lib/eventColor';
import { getDayNames, getHoliday, getLocaleData, getMonthName } from '@/lib/i18n';
import { formatTzTime, getEventDateRangeKeys } from '@/lib/tz';

// Model for /frame.png: a still picture of the coming days as a grid of days
// and people. The default "vertical" layout is a paper family calendar, one row
// per day running down the page and one column per person; "horizontal" turns
// it round, one row per person and one column per day. Sized for a 4K TV showing it as artwork (Samsung The
// Frame's Art Mode). Nobody can scroll or tap a picture, so the layout is
// solved here: everything still to come is shown, at the largest type size at
// which it all fits, with busy cells set in two columns when that allows
// larger type. Events that are over are left out. Only in the pathological
// case where even the smallest type overflows is a cell cut short with a "+N".

export const FRAME_W = 3840;
export const FRAME_H = 2160;

// Geometry shared with the component, in pixels of the 4K canvas.
export const FRAME_PAD = 72;
export const FRAME_HEAD_H = 200;
export const FRAME_TODAY_WEIGHT = 1.5;   // today's column is wider when days run across
export const FRAME_CELL_PAD = 18;
export const FRAME_BAR_W = 10;
export const FRAME_ROW_PAD = 16;
const FONT_SIZES = [60, 54, 48, 42, 38, 34, 31, 28, 26, 24, 22, 20, 18, 16, 14, 12];
export const FRAME_SUBCOL_GAP = 28;   // between the two columns of a busy cell
const LINE_HEIGHT = 1.3;       // real line pitch, in ems
// Satori sizes a line as the font's own height scaled by lineHeight / 1.2, not
// as lineHeight ems. Noto Sans is 1.362 em tall, so the CSS value has to be
// smaller than the pitch wanted or every estimate below comes out short.
const CSS_LINE_HEIGHT = LINE_HEIGHT / (1.362 / 1.2);
const ITEM_GAP = 0.22;        // space under each item, in ems
const CHAR_W = 0.57;          // average glyph advance, in ems
const TIME_SCALE = 0.8;       // the time is set smaller than the title
const TIME_W = 2.75;          // width reserved for "00:00", in ems of the title size

// A cell is only split in two columns if each still fits this many characters a line.
const MIN_TWO_UP_CHARS = 16;

export interface FrameItem {
  key: string;
  time: string | null;   // null for all-day and for days an event merely spans
  title: string;
  color: string;
  lines: number;         // estimated wrapped lines of the title, 1 or 2
}

export interface FrameCell {
  columns: FrameItem[][]; // one stack of events, or two side by side when the cell is busy
  hidden: number;         // events left out for lack of room; 0 unless nothing else worked
}

export interface FrameDay {
  key: string;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
  holiday: string | null;
}

export type FrameLayout = 'vertical' | 'horizontal';

// What a row or a column stands for: a day or a person, depending on the layout.
export type FrameHead = { day: FrameDay; person?: undefined } | { person: Person; day?: undefined };

export interface FrameRow {
  head: FrameHead;
  height: number;        // minimum row height in pixels; spare room is shared equally
  cells: FrameCell[];    // one per column, in the order of FrameModel.cols
  today: boolean[];      // per cell: does it belong to today
}

export interface FrameModel {
  title: string;
  subtitle: string;
  layout: FrameLayout;
  cols: FrameHead[];     // people with nothing in view are left out of either axis
  colWeights: number[];
  empty: boolean;        // nobody has anything in view
  labelWidth: number;    // width of the row-label column
  labelFontSize: number; // row labels shrink when there are many rows
  colHeadHeight: number;
  rows: FrameRow[];
  fontSize: number;
  lineHeight: number;
  itemGap: number;
  timeWidth: number;
  timeFontSize: number;
  emptyText: string;
}

// The renderer fetches glyphs it doesn't have (emoji, CJK, …) from public
// CDNs, sending the text along. Calendar text is private, so anything the
// bundled Noto Sans can't draw is dropped before it gets that far.
export function frameText(raw: string): string {
  return raw
    .replace(/[^ -~ -ɏͰ-ϿЀ-ӿ‐-‧‰-›€]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemUnits(item: FrameItem): number {
  return item.lines * LINE_HEIGHT + ITEM_GAP;
}

interface RawItem extends Omit<FrameItem, 'lines'> { sort: string; }

export function buildFrameModel(input: {
  startKey: string;          // first day shown, YYYY-MM-DD in the display timezone
  dayCount: number;
  todayKey: string;
  now: Date;
  events: CalendarEvent[];
  people: Person[];
  sources: CalendarSource[];
  settings: Record<string, string>;
  layout?: FrameLayout;
}): FrameModel {
  const layoutKind: FrameLayout = input.layout === 'horizontal' ? 'horizontal' : 'vertical';
  const vertical = layoutKind === 'vertical';
  const { startKey, dayCount, todayKey, now, events, people, sources, settings } = input;
  const tz = settings.display_timezone || 'Europe/Oslo';
  const locale = settings.locale || 'en';
  const t = getLocaleData(locale);
  const dayShort = getDayNames(locale, true);
  const dayLong = getDayNames(locale, false);

  const start = parseISO(startKey);
  const dates = Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  const days: FrameDay[] = dates.map(d => {
    const key = format(d, 'yyyy-MM-dd');
    const weekday = (d.getDay() + 6) % 7;
    return {
      key,
      label: key === todayKey ? t.nav.today : `${dayShort[weekday]} ${d.getDate()}.`,
      isToday: key === todayKey,
      isWeekend: weekday >= 5,
      holiday: getHoliday(locale, key),
    };
  });
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));

  // people × days buckets
  const grid = new Map<string, RawItem[][]>(people.map(p => [p.id, days.map(() => [])]));
  for (const ev of events) {
    const cells = grid.get(ev.person_id);
    if (!cells) continue;
    const { startStr, endStr } = getEventDateRangeKeys(ev, tz);
    const title = frameText(ev.title || '');
    if (!title) continue;
    const color = getEventColor(ev, sources, people);
    const endMs = new Date(ev.end_date || ev.start_date).getTime();
    for (const day of days) {
      if (day.key < startStr || day.key > endStr) continue;
      // What is over is no longer worth the room: timed events once they have
      // ended, all-day ones once their day has.
      if (ev.all_day ? day.key < todayKey : endMs < now.getTime()) continue;
      const startsHere = day.key === startStr;
      const timed = !ev.all_day && startsHere;
      cells[dayIndex.get(day.key)!].push({
        key: `${ev.id}:${day.key}`,
        time: timed ? formatTzTime(ev.start_date, tz) : null,
        title,
        color,
        // all-day and carried-over events first, then by start time
        sort: timed ? `1${ev.start_date}` : `0${ev.start_date}`,
      });
    }
  }
  for (const cells of Array.from(grid.values()))
    for (const cell of cells) cell.sort((a, b) => a.sort.localeCompare(b.sort) || a.title.localeCompare(b.title));

  // People with nothing in view would only shrink the type for everyone else.
  const active = people.filter(p => grid.get(p.id)!.some(c => c.length > 0));

  // Rows are days and columns people, or the other way round.
  const dayHeads: FrameHead[] = days.map(day => ({ day }));
  const personHeads: FrameHead[] = active.map(person => ({ person }));
  const rowHeads = vertical ? dayHeads : personHeads;
  const cols = vertical ? personHeads : dayHeads;
  const colWeights = cols.map(c => (c.day?.isToday ? FRAME_TODAY_WEIGHT : 1));
  const weightSum = colWeights.reduce((a, b) => a + b, 0) || 1;
  const labelFontSize = rowHeads.length > 9 ? 46 : 64;
  // Every row is at least tall enough for its day or person label.
  const minRowPx = Math.round(labelFontSize * 1.15) + 22;
  const labelWidth = vertical ? 330 : 340;
  const colHeadHeight = vertical ? 110 : 150;
  const gridW = FRAME_W - 2 * FRAME_PAD - labelWidth;
  const bodyH = FRAME_H - 2 * FRAME_PAD - FRAME_HEAD_H - colHeadHeight;
  const bucket = (row: FrameHead, col: FrameHead) => {
    const person = (row.person ?? col.person)!;
    const day = (row.day ?? col.day)!;
    return { all: grid.get(person.id)![dayIndex.get(day.key)!], isToday: day.isToday };
  };

  const stack = (items: FrameItem[]) => items.reduce((sum, it) => sum + itemUnits(it), 0);
  const wrap = (raw: RawItem[], width: number, fontSize: number) => raw.map((it): FrameItem => {
    const textW = width - FRAME_BAR_W - 14 - (it.time ? TIME_W * fontSize : 0);
    const perLine = Math.max(4, Math.floor(textW / (CHAR_W * fontSize)));
    return { ...it, lines: it.title.length > perLine ? 2 : 1 };
  });

  const layout = (fontSize: number, twoUp: boolean) => {
    const rows = rowHeads.map(head => {
      const cells = cols.map((col, i) => {
        const raw = bucket(head, col).all;
        const innerW = (gridW * colWeights[i]) / weightSum - 2 * FRAME_CELL_PAD;
        const one = [wrap(raw, innerW, fontSize)];
        if (!twoUp || raw.length < 2) return one;
        // Two columns, read down then across, split where they balance best.
        // Not where a column would be too narrow to hold words: smaller type
        // in one column reads better than titles chopped mid-word.
        const halfW = (innerW - FRAME_SUBCOL_GAP) / 2;
        if ((halfW - FRAME_BAR_W - 14 - TIME_W * fontSize) / (CHAR_W * fontSize) < MIN_TWO_UP_CHARS) return one;
        const half = wrap(raw, halfW, fontSize);
        let best = 1, bestH = Infinity;
        for (let cut = 1; cut < half.length; cut++) {
          const h = Math.max(stack(half.slice(0, cut)), stack(half.slice(cut)));
          if (h < bestH - 0.001) { bestH = h; best = cut; }
        }
        return bestH < stack(one[0]) - 0.001 ? [half.slice(0, best), half.slice(best)] : one;
      });
      const minUnits = (minRowPx - 2 * FRAME_ROW_PAD) / fontSize;
      const need = Math.max(minUnits, ...cells.map(c => Math.max(...c.map(stack))));
      return { head, cells, need, minUnits };
    });
    const available = (bodyH - rows.length * (2 * FRAME_ROW_PAD + 2)) / fontSize;
    const needed = rows.reduce((s, r) => s + r.need, 0);
    return { rows, available, needed };
  };

  // Largest type at which everything fits, preferring single-column cells at
  // any given size.
  const smallest = FONT_SIZES[FONT_SIZES.length - 1];
  let fontSize = smallest;
  let solved = layout(smallest, true);
  search: for (const size of FONT_SIZES) {
    for (const twoUp of [false, true]) {
      const attempt = layout(size, twoUp);
      if (attempt.needed <= attempt.available) { fontSize = size; solved = attempt; break search; }
    }
  }

  // Last resort, when even the smallest size overflows: share the height in
  // proportion to need and cut each cell to what its row can hold. Rows
  // already at the minimum keep it; the rest shrink to make up for them.
  let scale = solved.needed > solved.available ? solved.available / solved.needed : 1;
  if (scale < 1) {
    const atMin = solved.rows.filter(r => r.need * scale <= r.minUnits);
    const fixed = atMin.reduce((s, r) => s + r.minUnits, 0);
    const flexible = solved.needed - atMin.reduce((s, r) => s + r.need, 0);
    if (flexible > 0) scale = Math.max(0, solved.available - fixed) / flexible;
  }
  const rows: FrameRow[] = solved.rows.map(r => {
    const cap = Math.max(r.minUnits, r.need * scale);
    const cells = r.cells.map((columns): FrameCell => {
      const total = columns.reduce((n, c) => n + c.length, 0);
      const kept = columns.map(items => {
        let used = 0;
        const fit: FrameItem[] = [];
        for (const it of items) {
          if (used + itemUnits(it) > cap + 0.01) break;
          used += itemUnits(it);
          fit.push(it);
        }
        return fit;
      });
      let hidden = total - kept.reduce((n, c) => n + c.length, 0);
      // Leave a line under the last column for the "+N" marker.
      const last = kept[kept.length - 1];
      while (hidden > 0 && last.length > 0 && stack(last) + LINE_HEIGHT * TIME_SCALE > cap + 0.01) { last.pop(); hidden++; }
      return { columns: kept, hidden };
    });
    const today = cols.map(col => bucket(r.head, col).isToday);
    return { head: r.head, height: Math.floor(cap * fontSize) + 2 * FRAME_ROW_PAD + 2, cells, today };
  });

  const weekday = (start.getDay() + 6) % 7;
  // Locale files capitalise month names for headings; mid-sentence only English does.
  const month = getMonthName(locale, start.getMonth());
  const title = `${dayLong[weekday]} ${start.getDate()}. ${locale === 'en' ? month : month.toLowerCase()}`;
  const subtitle = `${t.calendar.weekNumber} ${getISOWeek(start)} · ${formatTzTime(now.toISOString(), tz)}`;

  return {
    title, subtitle, layout: layoutKind, cols, colWeights, empty: active.length === 0, labelWidth, labelFontSize, colHeadHeight, rows, fontSize,
    lineHeight: CSS_LINE_HEIGHT,
    itemGap: Math.round(ITEM_GAP * fontSize),
    timeWidth: Math.round(TIME_W * fontSize),
    timeFontSize: Math.round(TIME_SCALE * fontSize),
    emptyText: t.calendar.noEvents,
  };
}
