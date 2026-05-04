'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, addDays,
  format, getISOWeek
} from 'date-fns';
import type { ViewType, CalendarEvent, CalendarSource, Person, LocaleData } from '@/types';
import { getMonthName } from '@/lib/i18n';
import MonthView from './MonthView';
import WeekView from './WeekView';
import RollingView from './RollingView';
import AgendaView from './AgendaView';
import EventDetailModal from './EventDetailModal';

interface CalendarViewProps {
  people: Person[];
  sources: CalendarSource[];
  t: LocaleData;
  locale: string;
  defaultView: ViewType;
  appName: string;
  dateFormat: string;
  timezone: string;
  rollingDays: number;
}

function getNavigationLabel(view: ViewType, date: Date, t: LocaleData, locale: string, dateFormat: string, rollingDays: number): string {
  switch (view) {
    case 'month': {
      const monthName = getMonthName(locale, date.getMonth());
      return `${monthName} ${date.getFullYear()}`;
    }
    case 'week': {
      const weekNum = getISOWeek(date);
      return `${t.calendar.weekNumber} ${weekNum}, ${date.getFullYear()}`;
    }
    case 'rolling': {
      const end = addDays(date, rollingDays - 1);
      return `${format(date, dateFormat)} – ${format(end, dateFormat)}`;
    }
    case 'agenda':
      return `${getMonthName(locale, date.getMonth())} ${date.getFullYear()}`;
    default:
      return '';
  }
}

function getDateRange(view: ViewType, date: Date, rollingDays: number): { start: Date; end: Date } {
  switch (view) {
    case 'month':
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case 'week':
      return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'rolling':
      return { start: date, end: addDays(date, rollingDays - 1) };
    case 'agenda':
      return { start: date, end: addDays(date, 90) };
    default:
      return { start: date, end: date };
  }
}

function navigateDate(view: ViewType, date: Date, direction: 'prev' | 'next'): Date {
  const delta = direction === 'next' ? 1 : -1;
  switch (view) {
    case 'month':
      return direction === 'next' ? addMonths(date, 1) : subMonths(date, 1);
    case 'week':
      return direction === 'next' ? addWeeks(date, 1) : subWeeks(date, 1);
    case 'rolling':
    case 'agenda':
      return addDays(date, delta * 14);
    default:
      return date;
  }
}

const VIEW_ORDER: ViewType[] = ['month', 'week', 'rolling', 'agenda'];

function MonthIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="4" width="4" height="4" rx="0.5" /><rect x="10" y="4" width="4" height="4" rx="0.5" /><rect x="17" y="4" width="4" height="4" rx="0.5" />
      <rect x="3" y="10" width="4" height="4" rx="0.5" /><rect x="10" y="10" width="4" height="4" rx="0.5" /><rect x="17" y="10" width="4" height="4" rx="0.5" />
      <rect x="3" y="16" width="4" height="4" rx="0.5" /><rect x="10" y="16" width="4" height="4" rx="0.5" /><rect x="17" y="16" width="4" height="4" rx="0.5" />
    </svg>
  );
}

function WeekIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="3" width="2.5" height="18" rx="0.5" /><rect x="6" y="3" width="2.5" height="18" rx="0.5" />
      <rect x="10" y="3" width="2.5" height="18" rx="0.5" /><rect x="14" y="3" width="2.5" height="18" rx="0.5" />
      <rect x="18" y="3" width="2.5" height="18" rx="0.5" /><rect x="22" y="3" width="2.5" height="4" rx="0.5" />
    </svg>
  );
}

function RollingIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="4" x2="8" y2="9" />
      <line x1="16" y1="4" x2="16" y2="9" />
      <line x1="7" y1="13" x2="10" y2="13" /><line x1="12" y1="13" x2="17" y2="13" />
      <line x1="7" y1="17" x2="10" y2="17" /><line x1="12" y1="17" x2="17" y2="17" />
    </svg>
  );
}

function AgendaIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <line x1="8" y1="6" x2="20" y2="6" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <line x1="8" y1="18" x2="20" y2="18" />
    </svg>
  );
}

const VIEW_ICONS: Record<ViewType, (active: boolean) => React.ReactNode> = {
  month: (a) => <MonthIcon active={a} />,
  week: (a) => <WeekIcon active={a} />,
  rolling: (a) => <RollingIcon active={a} />,
  agenda: (a) => <AgendaIcon active={a} />,
};

export default function CalendarView({
  people, sources, t, locale, defaultView, appName, dateFormat, timezone, rollingDays,
}: CalendarViewProps) {
  const [view, setView] = useState<ViewType>(defaultView);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setDark(isDark);
  };

  const fetchEvents = useCallback(async (v: ViewType, d: Date) => {
    setLoading(true);
    const { start, end } = getDateRange(v, d, rollingDays);
    try {
      const res = await fetch(`/api/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(view, date);
    const interval = setInterval(() => fetchEvents(view, date), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [view, date, fetchEvents]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchEvents(view, date);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [view, date, fetchEvents]);

  const handleViewChange = (newView: ViewType) => {
    setView(newView);
    setDate(new Date());
  };

  const handlePrev = () => setDate(d => navigateDate(view, d, 'prev'));
  const handleNext = () => setDate(d => navigateDate(view, d, 'next'));
  const handleToday = () => setDate(new Date());

  const handleEventAssign = async (sourceId: string, icalUid: string, personIds: string[]) => {
    // Fetch existing overrides for this source, replace entries for this ical_uid
    const existing: Array<{ ical_uid: string; person_id: string }> = await fetch(
      `/api/sources/${sourceId}/overrides`
    ).then(r => r.json()).catch(() => []);
    const others = existing.filter(o => o.ical_uid !== icalUid);

    // If personIds is empty → store a __none__ sentinel so the override EXISTS
    // but matches no real person (event hidden from everyone).
    // __none__ is allowed because the person_id FK was removed in the migration.
    const effectiveIds = personIds.length > 0 ? personIds : ['__none__'];
    const newEntries = effectiveIds.map(pid => ({ ical_uid: icalUid, person_id: pid }));

    const res = await fetch(`/api/sources/${sourceId}/overrides`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: [...others, ...newEntries] }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error ${res.status}`);
    }
    // Re-fetch events so the calendar reflects the change immediately
    await fetchEvents(view, date);
  };

  // Mobile person switcher
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) < threshold) return;

    const currentIndex = selectedPerson ? people.findIndex(p => p.id === selectedPerson) : -1;
    if (diff > 0) {
      // Swiped left → next person
      const nextIndex = (currentIndex + 1) % (people.length + 1);
      setSelectedPerson(nextIndex === people.length ? null : people[nextIndex].id);
    } else {
      // Swiped right → previous person
      const prevIndex = currentIndex === 0 ? people.length : currentIndex - 1;
      setSelectedPerson(prevIndex === people.length ? null : people[prevIndex].id);
    }
    setTouchStart(null);
  };

  // Filter events for mobile single-person view
  const filteredEvents = selectedPerson ? events.filter(e => e.person_id === selectedPerson) : events;

  const navLabel = getNavigationLabel(view, date, t, locale, dateFormat, rollingDays);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2 shadow-sm z-20">
        {/* App name — desktop only */}
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 hidden sm:block mr-2 shrink-0">
          {appName}
        </h1>

        {/* Navigation */}
        <button
          onClick={handleToday}
          className="px-2.5 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
        >
          {t.nav.today}
        </button>
        <button
          onClick={handlePrev}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          aria-label={t.nav.prev}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={handleNext}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          aria-label={t.nav.next}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Date label — grows to fill available space */}
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
          {navLabel}
        </span>

        {loading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
        )}

        {/* View switcher — desktop only (mobile uses bottom bar) */}
        <div className="hidden sm:flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5 shrink-0">
          {VIEW_ORDER.map(v => (
            <button
              key={v}
              onClick={() => handleViewChange(v)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                view === v
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {t.views[v]}
            </button>
          ))}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          aria-label="Toggle dark mode"
        >
          {dark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <a
          href="/settings"
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          aria-label={t.nav.settings}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </a>
      </header>

      {/* ── Mobile person switcher ────────────────────────────────────── */}
      {people.length > 1 && (
        <div className="sm:hidden flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedPerson(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedPerson === null
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
            }`}
          >
            {t.nav.all || 'All'}
          </button>
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => setSelectedPerson(person.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedPerson === person.id
                  ? `text-white`
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
              }`}
              style={selectedPerson === person.id ? { backgroundColor: person.color } : {}}
            >
              {person.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Calendar content — leaves room for mobile bottom bar ───────── */}
      <main 
        className="flex-1 overflow-hidden pb-14 sm:pb-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {view === 'month' && (
          <MonthView date={date} events={filteredEvents} sources={sources} people={people} t={t} locale={locale} timezone={timezone} onEventClick={setSelectedEvent} />
        )}
        {view === 'week' && (
          <WeekView date={date} events={filteredEvents} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} onEventClick={setSelectedEvent} />
        )}
        {view === 'rolling' && (
          <RollingView date={date} events={filteredEvents} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} rollingDays={rollingDays} onEventClick={setSelectedEvent} />
        )}
        {view === 'agenda' && (
          <AgendaView date={date} events={filteredEvents} sources={sources} people={people} t={t} locale={locale} timezone={timezone} onEventClick={setSelectedEvent} />
        )}
      </main>

      {/* ── Event detail modal ─────────────────────────────────────────── */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          allEvents={events}
          sources={sources}
          people={people}
          dateFormat={dateFormat}
          timezone={timezone}
          onClose={() => setSelectedEvent(null)}
          onAssign={handleEventAssign}
        />
      )}

      {/* ── Mobile bottom tab bar ───────────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 h-14 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-20 safe-area-inset-bottom">
        {VIEW_ORDER.map(v => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => handleViewChange(v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {VIEW_ICONS[v](active)}
              <span className="text-[10px] font-medium leading-none">{t.views[v]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
