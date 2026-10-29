import type { CalendarEvent } from '@/types';
import type { LiteDay, LiteModel } from '@/lib/lite';
import { getEventColor, getTextColor } from '@/lib/eventColor';
import { formatTzTime, getEventDateRangeKeys } from '@/lib/tz';
import { getHoliday } from '@/lib/i18n';

// Server-rendered only. No 'use client', no hooks, no Tailwind: this page is
// rendered to a static HTML string and must work on very old browsers, so the
// stylesheet below sticks to tables, blocks and inline-block — no grid, no
// flex-gap, no custom properties, no position: sticky.

const CSS = `
html,body{margin:0;padding:0;background:#fff;color:#111}
body{font-family:Helvetica,Arial,sans-serif;font-size:14px;-webkit-text-size-adjust:100%}
a{color:#1d4ed8}
.nav{padding:8px 8px 4px;background:#f3f4f6;border-bottom:1px solid #d1d5db}
.row{margin-bottom:4px}
.nav a{display:inline-block;padding:9px 13px;margin:0 4px 4px 0;border:1px solid #9ca3af;border-radius:4px;background:#fff;color:#1f2937;text-decoration:none;font-size:15px;line-height:1}
.nav a.on{background:#2563eb;border-color:#2563eb;color:#fff}
.nav a.pp.on{border-color:transparent}
.title{font-size:19px;font-weight:bold;padding:10px 8px 6px}
table.m{width:100%;border-collapse:collapse;table-layout:fixed}
table.m th{font-size:12px;padding:5px 2px;border:1px solid #d1d5db;background:#f9fafb;color:#374151}
table.m th.wk,table.m td.wk{width:26px;color:#9ca3af;font-size:10px;text-align:center}
table.m td{vertical-align:top;border:1px solid #d1d5db;padding:2px;height:86px;font-size:12px;overflow:hidden}
td.out{background:#fafafa}
td.out .dn{color:#b0b0b0}
td.today{background:#fef3c7}
.dn{display:block;font-weight:bold;padding:1px 2px 2px}
.dn a{color:inherit;text-decoration:none}
.ev{display:block;padding:2px 4px;margin:1px 0;border-radius:3px;font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev .t{font-weight:bold;margin-right:3px}
.more{display:block;font-size:11px;padding:1px 4px;text-decoration:none}
.day{padding:8px;border-bottom:1px solid #e5e7eb}
.day h3{margin:0 0 6px;font-size:16px}
.day h3 small{color:#6b7280;font-weight:normal;margin-left:6px}
.day.today{background:#fffbeb}
.day .ev{font-size:14px;padding:7px 9px;margin:5px 0;white-space:normal}
.day .ev .t{margin-right:6px}
.sub{display:block;font-size:12px;opacity:.85;margin-top:2px}
.hol{color:#c2410c;font-size:11px;display:block;padding:0 2px}
.day .hol{font-size:13px;margin-bottom:4px}
.empty{color:#9ca3af;font-style:italic;padding:2px 4px;font-size:13px}
`;

function timeLabel(ev: CalendarEvent, dayKey: string, tz: string): string | null {
  if (ev.all_day) return null;
  const { startStr } = getEventDateRangeKeys(ev, tz);
  // Continuation days of a multi-day timed event get an arrow instead of a time.
  return startStr === dayKey ? formatTzTime(ev.start_date, tz) : '→';
}

function Event({ ev, dayKey, m, detailed }: { ev: CalendarEvent; dayKey: string; m: LiteModel; detailed: boolean }) {
  const bg = getEventColor(ev, m.sources, m.people);
  const fg = getTextColor(bg);
  const time = timeLabel(ev, dayKey, m.timezone);
  const person = m.people.find(p => p.id === ev.person_id);
  let range: string | null = time;
  if (detailed && time && time !== '→' && ev.end_date) {
    const end = formatTzTime(ev.end_date, m.timezone);
    if (end !== time) range = `${time} – ${end}`;
  }
  return (
    <div className="ev" style={{ backgroundColor: bg, color: fg }} title={ev.title}>
      {range && <span className="t">{range}</span>}
      {ev.all_day !== 0 && detailed && <span className="t">{m.t.calendar.allDay}</span>}
      {ev.title}
      {detailed && (ev.location || person) && (
        <span className="sub">
          {person ? person.name : ''}{person && ev.location ? ' · ' : ''}{ev.location || ''}
        </span>
      )}
    </div>
  );
}

function MonthGrid({ m }: { m: LiteModel }) {
  return (
    <table className="m">
      <thead>
        <tr>
          <th className="wk" />
          {m.dayNamesShort.map(n => <th key={n}>{n}</th>)}
        </tr>
      </thead>
      <tbody>
        {m.weeks.map(w => (
          <tr key={w.weekNumber + w.days[0].key}>
            <td className="wk">{w.weekNumber}</td>
            {w.days.map(d => {
              const evs = m.eventsByDay[d.key] || [];
              const shown = evs.slice(0, m.maxPerCell);
              const extra = evs.length - shown.length;
              const holiday = getHoliday(m.locale, d.key);
              const cls = [d.inMonth ? '' : 'out', d.key === m.todayKey ? 'today' : ''].join(' ').trim();
              return (
                <td key={d.key} className={cls || undefined}>
                  <span className="dn"><a href={m.dayHref(d.key)}>{d.dayOfMonth}</a></span>
                  {holiday && <span className="hol">{holiday}</span>}
                  {shown.map(ev => <Event key={ev.id} ev={ev} dayKey={d.key} m={m} detailed={false} />)}
                  {extra > 0 && <a className="more" href={m.dayHref(d.key)}>+{extra}</a>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayList({ m, days, headings }: { m: LiteModel; days: LiteDay[]; headings: boolean }) {
  return (
    <div>
      {days.map(d => {
        const evs = m.eventsByDay[d.key] || [];
        const holiday = getHoliday(m.locale, d.key);
        const [y, mo, da] = d.key.split('-');
        return (
          <div key={d.key} className={d.key === m.todayKey ? 'day today' : 'day'}>
            {headings && (
              <h3>
                <a href={m.dayHref(d.key)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {m.dayNamesLong[d.weekday]} {parseInt(da, 10)}.{parseInt(mo, 10)}.
                </a>
                <small>{y}</small>
              </h3>
            )}
            {holiday && <span className="hol">{holiday}</span>}
            {evs.length === 0 && <div className="empty">{m.t.calendar.noEvents}</div>}
            {evs.map(ev => <Event key={ev.id} ev={ev} dayKey={d.key} m={m} detailed={true} />)}
          </div>
        );
      })}
    </div>
  );
}

export default function LitePage({ m }: { m: LiteModel }) {
  return (
    <html lang={m.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {m.refreshSeconds > 0 && <meta httpEquiv="refresh" content={String(m.refreshSeconds)} />}
        <title>{`${m.title} · ${m.appName}`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div className="nav">
          <div className="row">
            {m.nav.views.map(v => (
              <a key={v.href} href={v.href} className={v.active ? 'on' : undefined}>{v.label}</a>
            ))}
            <a href={m.nav.prev} title={m.t.nav.prev}>‹</a>
            <a href={m.nav.today}>{m.t.nav.today}</a>
            <a href={m.nav.next} title={m.t.nav.next}>›</a>
          </div>
          <div className="row">
            {m.nav.people.map(p => (
              <a
                key={p.href}
                href={p.href}
                className={p.active ? 'pp on' : 'pp'}
                style={p.active && p.color ? { backgroundColor: p.color, color: getTextColor(p.color) } : undefined}
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>
        <div className="title">{m.title}</div>
        {m.view === 'month' ? <MonthGrid m={m} /> : <DayList m={m} days={m.days} headings={m.view === 'week'} />}
      </body>
    </html>
  );
}
