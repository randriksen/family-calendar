'use client';

import { useState, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import type { Person, CalendarSource, LocaleData } from '@/types';
import ColorPicker from '@/components/ui/ColorPicker';

interface CalendarSettingsProps {
  people: Person[];
  sources: CalendarSource[];
  t: LocaleData;
  onRefresh: () => void;
}

interface SourceEvent {
  ical_uid: string;
  title: string;
  start_date: string;
  all_day: number;
  person_ids: string[];
}

interface Override {
  ical_uid: string;
  person_id: string;
}

function LastFetched({ dateStr, t }: { dateStr?: string | null; t: LocaleData }) {
  if (!dateStr) return <span className="text-gray-400 dark:text-gray-500 text-xs">{t.settings.calendars.never}</span>;
  try {
    const d = parseISO(dateStr);
    return (
      <span className="text-gray-500 dark:text-gray-400 text-xs" title={d.toISOString()}>
        {format(d, 'dd.MM.yyyy HH:mm')}
      </span>
    );
  } catch {
    return <span className="text-gray-400 dark:text-gray-500 text-xs">{dateStr}</span>;
  }
}

function PersonChips({ personIds, people }: { personIds: string[]; people: Person[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {personIds.map(pid => {
        const p = people.find(x => x.id === pid);
        if (!p) return null;
        return (
          <span
            key={pid}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name}
          </span>
        );
      })}
    </div>
  );
}

function PersonMultiSelect({
  people,
  selected,
  onChange,
  label,
}: {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {people.map(p => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all"
              style={
                on
                  ? { backgroundColor: p.color, borderColor: p.color, color: '#fff' }
                  : { borderColor: p.color, color: p.color, backgroundColor: 'transparent' }
              }
            >
              {on && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventAssigner({
  source,
  people,
  t,
  onSaved,
}: {
  source: CalendarSource;
  people: Person[];
  t: LocaleData;
  onSaved: () => void;
}) {
  const [events, setEvents] = useState<SourceEvent[] | null>(null);
  // map ical_uid → selected person_ids (empty = all people, i.e. no override)
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/sources/${source.id}/events`).then(r => r.json()),
      fetch(`/api/sources/${source.id}/overrides`).then(r => r.json()),
    ])
      .then(([evts, ovrs]) => {
        if (cancelled) return;
        if (evts.error) { setLoadError(evts.error); return; }
        setEvents(Array.isArray(evts) ? evts : []);
        // Group overrides by ical_uid → string[]
        const map: Record<string, string[]> = {};
        if (Array.isArray(ovrs)) {
          (ovrs as Override[]).forEach(o => {
            if (!map[o.ical_uid]) map[o.ical_uid] = [];
            map[o.ical_uid].push(o.person_id);
          });
        }
        setOverrides(map);
      })
      .catch(() => { if (!cancelled) setLoadError('Failed to load'); });
    return () => { cancelled = true; };
  }, [source.id]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const overrideList: Override[] = [];
      for (const [ical_uid, ids] of Object.entries(overrides)) {
        for (const person_id of ids) {
          overrideList.push({ ical_uid, person_id });
        }
      }
      const res = await fetch(`/api/sources/${source.id}/overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: overrideList }),
      });
      if (!res.ok) throw new Error('Failed to save overrides');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch {
      setSaveError('Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <p className="text-xs text-red-500 py-2">{loadError}</p>;

  if (!events) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 py-2 flex items-center gap-1.5">
        <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />
        {t.settings.calendars.loadingEvents}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
        {source.last_fetched_at ? t.settings.calendars.noEventsToAssign : t.settings.calendars.syncFirst}
      </p>
    );
  }

  const sourcePeople = people.filter(p => source.person_ids.includes(p.id));

  return (
    <div className="space-y-2">
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {events.map(evt => {
          const selected = overrides[evt.ical_uid] ?? [];
          const isAll = selected.length === 0;
          return (
            <div key={evt.ical_uid} className="py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <div className="mb-1">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{evt.title}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {format(new Date(evt.start_date), evt.all_day ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm')}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {/* "All" pill — clears override */}
                <button
                  type="button"
                  onClick={() => setOverrides(prev => { const n = { ...prev }; delete n[evt.ical_uid]; return n; })}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isAll
                      ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-700 dark:border-gray-200'
                      : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-transparent'
                  }`}
                >
                  {t.settings.calendars.allPeople}
                </button>
                {sourcePeople.map(p => {
                  const on = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setOverrides(prev => {
                          const cur = prev[evt.ical_uid] ?? [];
                          const next = on ? cur.filter(x => x !== p.id) : [...cur, p.id];
                          if (next.length === 0) {
                            const n = { ...prev }; delete n[evt.ical_uid]; return n;
                          }
                          return { ...prev, [evt.ical_uid]: next };
                        });
                      }}
                      className="px-2 py-0.5 rounded-full text-xs font-medium border-2 transition-all"
                      style={
                        on
                          ? { backgroundColor: p.color, borderColor: p.color, color: '#fff' }
                          : { borderColor: p.color, color: p.color, backgroundColor: 'transparent' }
                      }
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saved ? t.settings.calendars.savedAssignments : saving ? '...' : t.settings.calendars.saveAssignments}
        </button>
        {saveError && (
          <span className="text-xs text-red-500">{saveError}</span>
        )}
      </div>
    </div>
  );
}

export default function CalendarSettings({ people, sources, t, onRefresh }: CalendarSettingsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPersonIds, setAddPersonIds] = useState<string[]>(people[0] ? [people[0].id] : []);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<'ical_url' | 'ical_file'>('ical_url');
  const [addUrl, setAddUrl] = useState('');
  const [addColor, setAddColor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [expandedAssign, setExpandedAssign] = useState<string | null>(null);
  const [editPeopleId, setEditPeopleId] = useState<string | null>(null);
  const [editPeopleIds, setEditPeopleIds] = useState<string[]>([]);
  const [savingPeople, setSavingPeople] = useState(false);
  const [editUrlId, setEditUrlId] = useState<string | null>(null);
  const [editUrlValue, setEditUrlValue] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setUploadedFilePath(null);
    setUploadedFileName(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      setUploadedFilePath(data.file_path);
      setUploadedFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addPersonIds.length === 0 || !addName.trim()) return;
    if (addType === 'ical_url' && !addUrl.trim()) return;
    if (addType === 'ical_file' && !uploadedFilePath) return;

    setAdding(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        person_ids: addPersonIds,
        name: addName.trim(),
        type: addType,
      };
      if (addType === 'ical_url') body.url = addUrl.trim();
      if (addType === 'ical_file') body.file_path = uploadedFilePath!;
      if (addColor) body.color = addColor;

      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add source');
      }

      const { id } = await res.json();
      fetch(`/api/sources/${id}/refresh`, { method: 'POST' }).catch(() => {});

      setShowAddForm(false);
      setAddName('');
      setAddUrl('');
      setAddColor('');
      setUploadedFilePath(null);
      setUploadedFileName(null);
      setAddPersonIds(people[0] ? [people[0].id] : []);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setAdding(false);
    }
  };

  const openEditPeople = (source: CalendarSource) => {
    setEditPeopleId(source.id);
    setEditPeopleIds(source.person_ids);
  };

  const saveSourcePeople = async (sourceId: string) => {
    if (editPeopleIds.length === 0) return;
    setSavingPeople(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: editPeopleIds }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditPeopleId(null);
      onRefresh();
    } catch {
      alert('Failed to save');
    } finally {
      setSavingPeople(false);
    }
  };

  const saveSourceUrl = async (sourceId: string) => {
    if (!editUrlValue.trim()) return;
    setSavingUrl(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editUrlValue.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditUrlId(null);
      onRefresh();
    } catch {
      alert('Failed to save URL');
    } finally {
      setSavingUrl(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm(t.settings.calendars.confirmDelete)) return;
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      if (expandedAssign === id) setExpandedAssign(null);
      if (editUrlId === id) setEditUrlId(null);
      onRefresh();
    } catch {
      alert('Failed to delete source');
    }
  };

  const refreshSource = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/sources/${id}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('Refresh failed');
      onRefresh();
    } catch {
      alert('Refresh failed');
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.settings.calendars.title}</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.settings.calendars.addSource}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Add source form */}
      {showAddForm && (
        <div className="border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t.settings.calendars.addSource}</h3>
          <form onSubmit={addSource} className="space-y-4">
            <PersonMultiSelect
              people={people}
              selected={addPersonIds}
              onChange={setAddPersonIds}
              label={t.settings.calendars.assignPeople}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.settings.calendars.sourceName}
              </label>
              <input
                type="text"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="My Calendar"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.settings.calendars.type}
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="ical_url"
                    checked={addType === 'ical_url'}
                    onChange={() => setAddType('ical_url')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.settings.calendars.icalUrl}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="ical_file"
                    checked={addType === 'ical_file'}
                    onChange={() => setAddType('ical_file')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.settings.calendars.icalFile}</span>
                </label>
              </div>
            </div>

            {addType === 'ical_url' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.settings.calendars.url}
                </label>
                <input
                  type="url"
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.settings.calendars.file}
                </label>
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-blue-500 bg-blue-50'
                      : uploadedFilePath
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      {t.settings.calendars.uploading}
                    </div>
                  ) : uploadedFilePath ? (
                    <div className="text-sm text-green-700 font-medium">✓ {uploadedFileName}</div>
                  ) : (
                    <p className="text-sm text-gray-500">{t.settings.calendars.dropzone}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.settings.calendars.sourceColor}{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <ColorPicker value={addColor || '#6b7280'} onChange={setAddColor} />
                {addColor && (
                  <button
                    type="button"
                    onClick={() => setAddColor('')}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Use person color
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={adding || addPersonIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {adding ? '...' : t.settings.calendars.addSource}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t.settings.people.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Flat source list */}
      <div className="space-y-3">
        {sources.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            {people.length === 0
              ? 'Add people first before adding calendars.'
              : 'No calendars yet.'}
          </p>
        )}
        {sources.map(source => (
          <div key={source.id} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    source.color ||
                    people.find(p => p.id === source.person_ids[0])?.color ||
                    '#6b7280',
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{source.name}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <PersonChips personIds={source.person_ids} people={people} />
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                    {source.type === 'ical_url' ? 'URL' : 'File'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t.settings.calendars.lastFetched}:</span>
                  <LastFetched dateStr={source.last_fetched_at} t={t} />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {source.type === 'ical_url' && (
                  <button
                    onClick={() => {
                      if (editUrlId === source.id) { setEditUrlId(null); }
                      else { setEditUrlId(source.id); setEditUrlValue(source.url || ''); setEditPeopleId(null); setExpandedAssign(null); }
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      editUrlId === source.id
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    Edit URL
                  </button>
                )}
                <button
                  onClick={() => {
                    if (editPeopleId === source.id) { setEditPeopleId(null); }
                    else { openEditPeople(source); setExpandedAssign(null); setEditUrlId(null); }
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    editPeopleId === source.id
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                >
                  {t.settings.calendars.assignPeople}
                </button>
                <button
                  onClick={() => {
                    setExpandedAssign(expandedAssign === source.id ? null : source.id);
                    setEditPeopleId(null);
                    setEditUrlId(null);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    expandedAssign === source.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                >
                  {t.settings.calendars.assignEvents}
                </button>
                <button
                  onClick={() => refreshSource(source.id)}
                  disabled={refreshingId === source.id}
                  className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {refreshingId === source.id ? '...' : t.settings.calendars.refresh}
                </button>
                <button
                  onClick={() => deleteSource(source.id)}
                  className="px-2.5 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  {t.settings.calendars.delete}
                </button>
              </div>
            </div>

            {/* Edit people panel */}
            {editPeopleId === source.id && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {t.settings.calendars.assignPeople}
                </p>
                <PersonMultiSelect
                  people={people}
                  selected={editPeopleIds}
                  onChange={setEditPeopleIds}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => saveSourcePeople(source.id)}
                    disabled={savingPeople || editPeopleIds.length === 0}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingPeople ? '...' : t.settings.calendars.saveAssignments}
                  </button>
                  <button
                    onClick={() => setEditPeopleId(null)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t.settings.people.cancel}
                  </button>
                </div>
              </div>
            )}

            {/* Edit URL panel */}
            {editUrlId === source.id && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Edit URL
                </p>
                <input
                  type="url"
                  value={editUrlValue}
                  onChange={e => setEditUrlValue(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => saveSourceUrl(source.id)}
                    disabled={savingUrl || !editUrlValue.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingUrl ? '...' : t.settings.calendars.saveAssignments}
                  </button>
                  <button
                    onClick={() => setEditUrlId(null)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t.settings.people.cancel}
                  </button>
                </div>
              </div>
            )}

            {expandedAssign === source.id && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {t.settings.calendars.assignEvents}
                </p>
                {source.person_ids.length < 2 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Assign this calendar to multiple people to split events between them.
                  </p>
                ) : (
                  <EventAssigner source={source} people={people} t={t} onSaved={onRefresh} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
