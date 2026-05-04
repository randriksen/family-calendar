'use client';

import { useState } from 'react';
import type { Settings, LocaleData, ViewType } from '@/types';
import { availableLocales } from '@/lib/i18n';

interface DisplaySettingsProps {
  settings: Settings;
  t: LocaleData;
  onSaved: () => void;
}

const REFRESH_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '360', label: '6 hours' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy (31/12/2026)' },
  { value: 'dd.MM.yyyy', label: 'dd.MM.yyyy (31.12.2026)' },
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy (12/31/2026)' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd (2026-12-31)' },
  { value: 'd. MMMM yyyy', label: 'd. MMMM yyyy (31. December 2026)' },
];

const VIEW_OPTIONS: { value: ViewType; labelKey: keyof LocaleData['views'] }[] = [
  { value: 'month', labelKey: 'month' },
  { value: 'week', labelKey: 'week' },
  { value: 'rolling', labelKey: 'rolling' },
  { value: 'agenda', labelKey: 'agenda' },
];

const ROLLING_DAYS_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '31', label: '31 days' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Oslo', label: 'Oslo (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (CET/CEST)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Athens', label: 'Athens (EET/EEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC' },
];

export default function DisplaySettings({ settings, t, onSaved }: DisplaySettingsProps) {
  const [appName, setAppName] = useState(settings.app_name || 'Familiekalender');
  const [locale, setLocale] = useState(settings.locale || 'no');
  const [refreshInterval, setRefreshInterval] = useState(settings.refresh_interval_minutes || '60');
  const [defaultView, setDefaultView] = useState<ViewType>((settings.default_view as ViewType) || 'month');
  const [dateFormat, setDateFormat] = useState(settings.date_format || 'dd/MM/yyyy');
  const [timezone, setTimezone] = useState(settings.display_timezone || 'Europe/Oslo');
  const [rollingDays, setRollingDays] = useState(settings.rolling_days || '31');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          locale,
          refresh_interval_minutes: refreshInterval,
          default_view: defaultView,
          date_format: dateFormat,
          display_timezone: timezone,
          rolling_days: rollingDays,
        }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved();
        // Full reload so server re-renders with new locale/app-name
        setTimeout(() => window.location.reload(), 800);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.settings.display.title}</h2>

      {/* App Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.appName}
        </label>
        <input
          type="text"
          value={appName}
          onChange={e => setAppName(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Locale */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.locale}
        </label>
        <select
          value={locale}
          onChange={e => setLocale(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="en">{t.settings.display.localeEn}</option>
          <option value="no">{t.settings.display.localeNo}</option>
        </select>
      </div>

      {/* Refresh interval */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.refreshInterval}
        </label>
        <select
          value={refreshInterval}
          onChange={e => setRefreshInterval(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {REFRESH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Default view */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.defaultView}
        </label>
        <select
          value={defaultView}
          onChange={e => setDefaultView(e.target.value as ViewType)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VIEW_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t.views[opt.labelKey]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.dateFormat}
        </label>
        <select
          value={dateFormat}
          onChange={e => setDateFormat(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DATE_FORMAT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.timezone}
        </label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIMEZONE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Rolling window */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.settings.display.rollingDays}
        </label>
        <select
          value={rollingDays}
          onChange={e => setRollingDays(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ROLLING_DAYS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '...' : t.settings.display.save}
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">{t.settings.display.saved}</span>
        )}
      </div>
    </div>
  );
}
