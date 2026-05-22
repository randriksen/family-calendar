'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent, CalendarSource, Person } from '@/types';
import { formatTzTime } from '@/lib/tz';
import { getEventColor } from './EventBadge';

interface SearchOverlayProps {
  people: Person[];
  sources: CalendarSource[];
  timezone: string;
  dateFormat: string;
  onEventClick: (event: CalendarEvent) => void;
  onClose: () => void;
}

function formatSearchDate(dateStr: string, allDay: number, timezone: string): string {
  try {
    const d = allDay
      ? new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
      : new Date(dateStr);
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: allDay ? undefined : timezone,
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(d);
    const time = !allDay ? ` ${formatTzTime(dateStr, timezone)}` : '';
    return date + time;
  } catch {
    return dateStr.slice(0, 10);
  }
}

export default function SearchOverlay({
  people, sources, timezone, onEventClick, onClose,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIndex]) {
      onEventClick(results[activeIndex] as CalendarEvent);
      onClose();
    }
  };

  const handleSelect = (event: CalendarEvent) => {
    onEventClick(event);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search events…"
            className="flex-1 bg-transparent text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd
            onClick={onClose}
            className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded cursor-pointer select-none"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No events found</div>
          )}
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Type at least 2 characters to search</div>
          )}
          {results.map((event, i) => {
            const person = people.find(p => p.id === event.person_id);
            const color = getEventColor(event as any, sources, people);
            const dateStr = formatSearchDate(event.start_date, event.all_day, timezone);
            const isActive = i === activeIndex;

            return (
              <button
                key={`${event.id}-${i}`}
                onClick={() => handleSelect(event as CalendarEvent)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {/* Person color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {event.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>{dateStr}</span>
                    {event.location && (
                      <>
                        <span>·</span>
                        <span className="truncate">{event.location}</span>
                      </>
                    )}
                    {person && (
                      <>
                        <span>·</span>
                        <span style={{ color: person.color }}>{person.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {isActive && (
                  <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    ↵
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 flex gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>Esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
