'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Person, CalendarSource, Settings, LocaleData } from '@/types';
import { getLocaleData } from '@/lib/i18n';
import PeopleSettings from '@/components/settings/PeopleSettings';
import CalendarSettings from '@/components/settings/CalendarSettings';
import DisplaySettings from '@/components/settings/DisplaySettings';

type Tab = 'people' | 'calendars' | 'display' | 'about';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('people');
  const [people, setPeople] = useState<Person[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [t, setT] = useState<LocaleData>(getLocaleData('no'));
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [peopleRes, sourcesRes, settingsRes] = await Promise.all([
        fetch('/api/people'),
        fetch('/api/sources'),
        fetch('/api/settings'),
      ]);
      const [peopleData, sourcesData, settingsData] = await Promise.all([
        peopleRes.json(),
        sourcesRes.json(),
        settingsRes.json(),
      ]);
      setPeople(peopleData);
      setSources(sourcesData);
      setSettings(settingsData);
      setT(getLocaleData(settingsData.locale || 'no'));
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSettingsSaved = () => {
    loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'people', label: t.settings.tabs.people },
    { id: 'calendars', label: t.settings.tabs.calendars },
    { id: 'display', label: t.settings.tabs.display },
    { id: 'about', label: t.settings.tabs.about },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <a
            href="/"
            onClick={e => { e.preventDefault(); window.location.href = '/'; }}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Back to calendar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.settings.title}</h1>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-0 border-b border-transparent -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'people' && (
          <PeopleSettings people={people} t={t} onRefresh={loadAll} />
        )}
        {activeTab === 'calendars' && (
          <CalendarSettings
            people={people}
            sources={sources}
            t={t}
            onRefresh={loadAll}
          />
        )}
        {activeTab === 'display' && settings && (
          <DisplaySettings
            settings={settings}
            t={t}
            onSaved={handleSettingsSaved}
          />
        )}
        {activeTab === 'about' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.settings.about.title}</h2>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{t.settings.about.description}</p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 space-y-1">
                <div>Built with Next.js 14, SQLite, node-ical, date-fns</div>
                <div>PWA-ready — add to home screen for kiosk use</div>
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href="/api/events/refresh"
                    onClick={async e => {
                      e.preventDefault();
                      await fetch('/api/events/refresh', { method: 'POST' });
                      alert('Refresh triggered!');
                    }}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Refresh all calendars now
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
