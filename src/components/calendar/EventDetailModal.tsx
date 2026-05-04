'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person } from '@/types';
import { getEventColor } from './EventBadge';

interface EventDetailModalProps {
  event: CalendarEvent;
  allEvents: CalendarEvent[];
  sources: CalendarSource[];
  people: Person[];
  dateFormat: string;
  onClose: () => void;
  onAssign: (sourceId: string, icalUid: string, personIds: string[]) => Promise<void>;
}

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1f2937' : '#ffffff';
}

function fmtDate(dateStr: string, allDay: boolean, dateFormat: string): string {
  try {
    return format(new Date(dateStr), allDay ? dateFormat : `${dateFormat} HH:mm`);
  } catch { return dateStr; }
}

export default function EventDetailModal({
  event, allEvents, sources, people, dateFormat, onClose, onAssign,
}: EventDetailModalProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const source = sources.find(s => s.id === event.source_id);
  const color = getEventColor(event, sources, people);
  const textColor = getTextColor(color);

  // People who currently have this event visible (filtered by overrides at query time)
  const currentPersonIds: string[] = event.ical_uid
    ? Array.from(new Set(
        allEvents
          .filter(e => e.source_id === event.source_id && e.ical_uid === event.ical_uid)
          .map(e => e.person_id)
          .filter(id => id !== '__none__')
      ))
    : [event.person_id];

  // People assigned to this source
  const sourcePeople = source ? people.filter(p => source.person_ids.includes(p.id)) : [];
  const canAssign = !!event.ical_uid && sourcePeople.length > 1;

  // Toggle state: which people should see this event
  const [selectedIds, setSelectedIds] = useState<string[]>(currentPersonIds);

  const togglePerson = (personId: string) => {
    setSelectedIds(prev =>
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    );
  };

  const isDirty = !(
    selectedIds.length === currentPersonIds.length &&
    selectedIds.every(id => currentPersonIds.includes(id))
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!event.ical_uid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAssign(event.source_id, event.ical_uid, selectedIds);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const dateStr = fmtDate(event.start_date, !!event.all_day, dateFormat);
  const endStr = event.end_date ? fmtDate(event.end_date, !!event.all_day, dateFormat) : null;
  const isMultiDay = event.end_date && event.start_date.slice(0, 10) !== event.end_date.slice(0, 10);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Coloured header */}
        <div className="px-4 pt-4 pb-3 flex items-start gap-3" style={{ backgroundColor: color }}>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-snug" style={{ color: textColor }}>{event.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/15 transition-colors flex-shrink-0 mt-0.5"
            style={{ color: textColor }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="px-4 py-3 space-y-2.5">

          {/* Date / time */}
          <Row icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }>
            {isMultiDay
              ? <>{dateStr} – {endStr}</>
              : <>{dateStr}{endStr && endStr !== dateStr ? ` – ${endStr.slice(-5)}` : ''}</>
            }
            {event.all_day && <span className="ml-1 text-xs text-gray-400">(all day)</span>}
          </Row>

          {/* Location */}
          {event.location && (
            <Row icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }>
              {event.location}
            </Row>
          )}

          {/* Description */}
          {event.description && (
            <Row icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            }>
              <span className="line-clamp-4 whitespace-pre-line">{event.description}</span>
            </Row>
          )}

          {/* Source */}
          {source && (
            <Row icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            }>
              {source.name}
            </Row>
          )}
        </div>

        {/* Assignment controls */}
        {canAssign && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                Show for
              </p>
              {/* All / None quick-select */}
              <div className="flex gap-2">
                <button
                  disabled={saving || selectedIds.length === sourcePeople.length}
                  onClick={() => setSelectedIds(sourcePeople.map(p => p.id))}
                  className="text-[10px] font-medium text-blue-500 disabled:opacity-30 hover:text-blue-700 transition-colors"
                >
                  All
                </button>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                <button
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] font-medium text-blue-500 disabled:opacity-30 hover:text-blue-700 transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            {saved ? (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Saved</p>
            ) : (
              <>
                {saveError && (
                  <p className="text-xs text-red-500 mb-2">⚠ {saveError}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {sourcePeople.map(p => {
                    const active = selectedIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        disabled={saving}
                        onClick={() => togglePerson(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all disabled:opacity-40"
                        style={
                          active
                            ? { backgroundColor: p.color, borderColor: p.color, color: getTextColor(p.color) }
                            : { borderColor: p.color, color: p.color, backgroundColor: 'transparent', opacity: 0.6 }
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: active ? getTextColor(p.color) : p.color }}
                        />
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={saving || !isDirty}
                  onClick={save}
                  className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                  style={
                    isDirty
                      ? { backgroundColor: color, color: textColor }
                      : { backgroundColor: '#e5e7eb', color: '#6b7280' }
                  }
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{children}</span>
    </div>
  );
}
