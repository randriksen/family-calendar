'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData, ViewType, Display } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import RollingView from '@/components/calendar/RollingView';
import AgendaView from '@/components/calendar/AgendaView';
import SlotDayView from '@/components/calendar/SlotDayView';

interface DisplayScreenProps {
  displayId: string;
  initialViews: string[];
  rotationIntervalSeconds: number;
  people: Person[];
  sources: CalendarSource[];
  t: LocaleData;
  locale: string;
  timezone: string;
  dateFormat: string;
  rollingDays: number;
  appName: string;
}

function getEventRange(view: ViewType, date: Date, rollingDays: number): { start: Date; end: Date } {
  switch (view) {
    case 'month':  return { start: startOfMonth(date), end: endOfMonth(date) };
    case 'week':   return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'day':    return { start: addDays(date, -1), end: addDays(date, 1) };
    case 'agenda': return { start: date, end: addDays(date, 90) };
    case 'rolling':
    default:       return { start: addDays(date, -90), end: addDays(date, rollingDays + 90) };
  }
}

function LiveClock({ timezone, locale }: { timezone: string; locale: string }) {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now));
      setDateStr(new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timezone, locale]);

  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400" />
      <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100 absolute left-1/2 -translate-x-1/2">{time}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{dateStr}</span>
    </div>
  );
}

export default function DisplayScreen({
  displayId, initialViews, rotationIntervalSeconds,
  people, sources, t, locale, timezone, dateFormat, rollingDays, appName,
}: DisplayScreenProps) {
  const [views, setViews] = useState<string[]>(initialViews);
  const [rotationInterval, setRotationInterval] = useState(rotationIntervalSeconds);
  const [viewIndex, setViewIndex] = useState(0);
  const [date, setDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const currentView = (views[viewIndex] ?? 'month') as ViewType;

  const fetchEvents = useCallback(async (v: ViewType) => {
    const { start, end } = getEventRange(v, date, rollingDays);
    try {
      const res = await fetch(`/api/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (res.ok) setEvents(await res.json());
    } catch { /* ignore */ }
  }, [date, rollingDays]);

  // Advance date every minute so views stay current after midnight
  useEffect(() => {
    const id = setInterval(() => setDate(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Initial + recurring event fetch
  useEffect(() => {
    fetchEvents(currentView);
    const id = setInterval(() => fetchEvents(currentView), 60_000);
    return () => clearInterval(id);
  }, [currentView, fetchEvents]);

  // Re-fetch display config every 30s so view/rotation changes from Settings take effect
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/displays/${displayId}`);
        if (res.ok) {
          const d: Display = await res.json();
          setViews(d.views);
          setRotationInterval(d.rotation_interval_seconds);
        }
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [displayId]);

  // Clamp viewIndex when views list shrinks
  useEffect(() => {
    setViewIndex(i => Math.min(i, views.length - 1));
  }, [views.length]);

  // View rotation
  useEffect(() => {
    if (rotationInterval <= 0 || views.length <= 1) return;
    const id = setInterval(() => {
      setViewIndex(i => (i + 1) % views.length);
    }, rotationInterval * 1000);
    return () => clearInterval(id);
  }, [rotationInterval, views.length]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center relative shadow-sm">
        <span className="text-base font-bold text-gray-900 dark:text-gray-100">{appName}</span>
        <LiveClock timezone={timezone} locale={locale} />
      </header>

      {/* Calendar content */}
      <main className="flex-1 overflow-hidden">
        {currentView === 'month' && (
          <MonthView date={date} events={events} sources={sources} people={people} t={t} locale={locale} timezone={timezone} />
        )}
        {currentView === 'week' && (
          <WeekView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} />
        )}
        {currentView === 'rolling' && (
          <RollingView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} rollingDays={rollingDays} />
        )}
        {currentView === 'agenda' && (
          <AgendaView date={date} events={events} sources={sources} people={people} t={t} locale={locale} timezone={timezone} />
        )}
        {currentView === 'day' && (
          <SlotDayView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} />
        )}
      </main>
    </div>
  );
}
