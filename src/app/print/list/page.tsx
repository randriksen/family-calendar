import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, getISOWeek,
} from 'date-fns';
import { getPeople, getSettings, getEvents } from '@/lib/db';
import { getLocaleData, getMonthName, getHoliday } from '@/lib/i18n';
import { getEventDateRangeKeys, formatTzTime } from '@/lib/tz';
import type { CalendarEvent, Person } from '@/types';
import ListPrintControls from './ListPrintControls';

export const dynamic = 'force-dynamic';

const MAX_PER_CELL = 4;

function personColor(personId: string, people: Person[]): string {
  return people.find(p => p.id === personId)?.color ?? '#6366f1';
}

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function PrintListPage({ searchParams }: PageProps) {
  const params   = await searchParams;
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

  // Bucket events by dateKey → personId → CalendarEvent[]
  const byDayPerson: Record<string, Record<string, CalendarEvent[]>> = {};
  for (const event of rawEvents) {
    const { startStr, endStr } = getEventDateRangeKeys(event, timezone);
    const cur = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr   + 'T00:00:00');
    while (cur <= end) {
      const key = format(cur, 'yyyy-MM-dd');
      (byDayPerson[key] ??= {});
      (byDayPerson[key][event.person_id] ??= []).push(event);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Group days into Mon-Sun weeks (some may include days from adjacent months)
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthStr   = format(monthDate, 'yyyy-MM');
  const monthName  = getMonthName(locale, monthDate.getMonth());
  const title      = `${monthName} ${monthDate.getFullYear()}`;
  const prevMonth  = format(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1), 'yyyy-MM');
  const nextMonth  = format(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1), 'yyyy-MM');

  const shortDayNames = [
    t.days.short.monday, t.days.short.tuesday, t.days.short.wednesday,
    t.days.short.thursday, t.days.short.friday, t.days.short.saturday, t.days.short.sunday,
  ];

  // Column widths (rough guide for table layout)
  const personColW = Math.max(60, Math.floor(480 / Math.max(people.length, 1)));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; }
      `}</style>

      <ListPrintControls title={title} prevMonth={prevMonth} nextMonth={nextMonth} currentMonth={monthStr} />

      <div className="px-4 pb-4 print:p-0">
        {/* Title */}
        <h1 className="text-center text-3xl font-bold tracking-widest uppercase my-4 print:mt-1 print:mb-2 text-gray-800">
          {monthName.toUpperCase()} {monthDate.getFullYear()}
        </h1>

        <table style={{ fontSize: 9 }}>
          <thead>
            <tr>
              {/* Week number column */}
              <th
                className="border border-gray-300 bg-gray-50 text-gray-400 font-normal"
                style={{ width: 18, minWidth: 18, padding: '2px 1px', textAlign: 'center', fontSize: 8 }}
              >
                Uke
              </th>
              {/* Date column */}
              <th
                className="border border-gray-300 bg-gray-50 text-gray-500 font-semibold text-left"
                style={{ width: 72, minWidth: 64, padding: '3px 4px' }}
              >
                Dag
              </th>
              {/* Person columns */}
              {people.map(p => (
                <th
                  key={p.id}
                  className="border border-gray-300 bg-gray-50 font-bold text-center"
                  style={{ width: personColW, padding: '3px 4px', color: p.color }}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {weeks.map((weekDays, wi) => {
              const weekNum = getISOWeek(weekDays[3]); // use Wednesday to avoid edge cases
              return weekDays.map((day, di) => {
                const dateKey  = format(day, 'yyyy-MM-dd');
                const inMonth  = isSameMonth(day, monthDate);
                const isSunday = day.getDay() === 0;
                const isSat    = day.getDay() === 6;
                const isWeekend = isSunday || isSat;
                const holiday  = getHoliday(locale, dateKey);
                const isHoliday = !!holiday;
                const shortDay = shortDayNames[(day.getDay() + 6) % 7]; // Mon=0

                const rowBg = !inMonth
                  ? '#f9fafb'
                  : isHoliday || isSunday
                  ? '#fff5f5'
                  : isSat
                  ? '#f8faff'
                  : 'white';

                const dayNameColor = isSunday || isHoliday ? '#dc2626' : isWeekend ? '#6b7280' : '#374151';

                return (
                  <tr key={dateKey} style={{ backgroundColor: rowBg }}>
                    {/* Week number — only on Monday (di===0) */}
                    {di === 0 && (
                      <td
                        rowSpan={7}
                        className="border border-gray-300 text-center text-gray-400 font-semibold"
                        style={{
                          fontSize: 8,
                          width: 18,
                          padding: '2px 1px',
                          verticalAlign: 'middle',
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          letterSpacing: 1,
                        }}
                      >
                        {weekNum}
                      </td>
                    )}

                    {/* Date cell */}
                    <td
                      className="border border-gray-300"
                      style={{ padding: '2px 4px', whiteSpace: 'nowrap', minHeight: 28 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 700,
                          lineHeight: 1,
                          color: inMonth ? dayNameColor : '#9ca3af',
                          minWidth: 16,
                          textAlign: 'right',
                        }}>
                          {format(day, 'd')}
                        </span>
                        <span style={{
                          fontSize: 8,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: inMonth ? dayNameColor : '#d1d5db',
                        }}>
                          {shortDay}
                        </span>
                      </div>
                      {holiday && (
                        <div style={{ fontSize: 7, color: '#dc2626', marginTop: 1, lineHeight: 1.2 }}>
                          {holiday}
                        </div>
                      )}
                    </td>

                    {/* Per-person event cells */}
                    {people.map(person => {
                      const personEvents = (byDayPerson[dateKey]?.[person.id] ?? [])
                        .sort((a, b) => b.all_day - a.all_day || a.start_date.localeCompare(b.start_date));
                      const overflow = personEvents.length > MAX_PER_CELL;
                      const shown    = personEvents.slice(0, MAX_PER_CELL);
                      const color    = personColor(person.id, people);

                      return (
                        <td
                          key={person.id}
                          className="border border-gray-300"
                          style={{ padding: '2px 3px', verticalAlign: 'top' }}
                        >
                          {shown.map((event, i) => {
                            const timeStr = !event.all_day
                              ? formatTzTime(event.start_date, timezone)
                              : '';
                            const isMultiDay = event.start_date.slice(0, 10) !== (event.end_date ?? event.start_date).slice(0, 10);
                            return (
                              <div
                                key={`${event.id}-${i}`}
                                style={{
                                  borderLeft: `2px solid ${color}`,
                                  backgroundColor: isMultiDay ? `${color}14` : `${color}0d`,
                                  paddingLeft: 2,
                                  paddingRight: 1,
                                  marginBottom: 1,
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  lineHeight: '13px',
                                  fontSize: 9,
                                  color: '#111827',
                                  fontStyle: isMultiDay ? 'italic' : 'normal',
                                }}
                              >
                                {timeStr && (
                                  <span style={{ color: '#6b7280', marginRight: 2 }}>{timeStr}</span>
                                )}
                                {event.title}
                              </div>
                            );
                          })}
                          {overflow && (
                            <div style={{ fontSize: 8, color: '#9ca3af', lineHeight: '12px' }}>
                              +{personEvents.length - MAX_PER_CELL}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>

        {/* Legend */}
        {people.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 print:mt-1">
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
