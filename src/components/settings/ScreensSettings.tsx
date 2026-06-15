'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LocaleData, Display } from '@/types';

interface ScreensSettingsProps {
  t: LocaleData;
}

const VIEW_OPTIONS = ['month', 'week', 'rolling', 'agenda', 'day'] as const;
type ViewKey = typeof VIEW_OPTIONS[number];

const ROTATION_INTERVALS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function ScreensSettings({ t }: ScreensSettingsProps) {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selected, setSelected] = useState<Display | null>(null);
  const [creating, setCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editViews, setEditViews] = useState<string[]>(['month']);
  const [editRotation, setEditRotation] = useState(false);
  const [editInterval, setEditInterval] = useState(60);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const ts = t.settings.screens;

  const loadDisplays = useCallback(async () => {
    const res = await fetch('/api/displays');
    if (res.ok) setDisplays(await res.json());
  }, []);

  useEffect(() => { loadDisplays(); }, [loadDisplays]);

  const openScreen = (d: Display) => {
    setSelected(d);
    setCreating(false);
    setEditName(d.name);
    setEditSlug(d.slug);
    setEditViews(d.views);
    setEditRotation(d.rotation_interval_seconds > 0);
    setEditInterval(d.rotation_interval_seconds > 0 ? d.rotation_interval_seconds : 60);
  };

  const openNew = () => {
    setSelected(null);
    setCreating(true);
    setEditName('');
    setEditSlug('');
    setEditViews(['month']);
    setEditRotation(false);
    setEditInterval(60);
  };

  const back = () => { setSelected(null); setCreating(false); };

  const handleNameChange = (v: string) => {
    setEditName(v);
    if (creating) setEditSlug(slugify(v));
  };

  const save = async () => {
    setSaving(true);
    const body = {
      name: editName.trim(),
      slug: editSlug,
      views: editRotation ? editViews : [editViews[0] ?? 'month'],
      rotation_interval_seconds: editRotation ? editInterval : 0,
    };
    const res = creating
      ? await fetch('/api/displays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch(`/api/displays/${selected!.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { back(); await loadDisplays(); }
  };

  const deleteScreen = async () => {
    if (!selected || !confirm(ts.confirmDelete)) return;
    await fetch(`/api/displays/${selected.id}`, { method: 'DELETE' });
    back();
    await loadDisplays();
  };

  const copyUrl = async (slug: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/display/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showDetail = selected !== null || creating;

  if (showDetail) {
    const displayUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/display/${editSlug}`;
    return (
      <div className="space-y-4">
        <button onClick={back} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {ts.title}
        </button>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{ts.name}</label>
            <input
              value={editName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Living Room"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{ts.slug}</label>
            <input
              value={editSlug}
              onChange={e => setEditSlug(e.target.value)}
              placeholder="living-room"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{ts.currentView}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VIEW_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => { setEditViews([v]); setEditRotation(false); }}
                  className={`py-3 rounded-lg text-sm font-semibold capitalize transition-colors ${
                    editViews[0] === v && !editRotation
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.views[v as ViewKey]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editRotation}
                onChange={e => setEditRotation(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ts.rotation}</span>
            </label>
            {editRotation && (
              <div className="mt-3 space-y-3 pl-7">
                <div className="flex flex-wrap gap-2">
                  {VIEW_OPTIONS.map(v => (
                    <button
                      key={v}
                      onClick={() => setEditViews(prev =>
                        prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                        editViews.includes(v)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {t.views[v as ViewKey]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{ts.rotationInterval}</span>
                  {ROTATION_INTERVALS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditInterval(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        editInterval === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!creating && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{ts.url}</label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-blue-600 dark:text-blue-400 font-mono overflow-x-auto whitespace-nowrap">
                  {displayUrl}
                </code>
                <button
                  onClick={() => copyUrl(editSlug)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap"
                >
                  {copied ? ts.copied : ts.copyUrl}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving || !editName.trim() || !editSlug}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? '…' : ts.save}
            </button>
            <button
              onClick={back}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              {ts.cancel}
            </button>
            {!creating && (
              <button
                onClick={deleteScreen}
                className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                {ts.delete}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{ts.title}</h2>
      <div className="space-y-3">
        {displays.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{ts.noScreens}</p>
        )}
        {displays.map(d => (
          <button
            key={d.id}
            onClick={() => openScreen(d)}
            className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {d.rotation_interval_seconds > 0
                  ? d.views.join(' → ')
                  : (t.views[d.views[0] as ViewKey] ?? d.views[0])
                } · /display/{d.slug}
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
        <button
          onClick={openNew}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {ts.addScreen}
        </button>
      </div>
    </div>
  );
}
