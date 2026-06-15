import { getDisplayBySlug, getPeople, getSources, getSettings } from '@/lib/db';
import { getLocaleData } from '@/lib/i18n';
import DisplayScreen from '@/components/display/DisplayScreen';
import type { Person, CalendarSource } from '@/types';

export default function DisplayPage({ params }: { params: { slug: string } }) {
  const display = getDisplayBySlug(params.slug);
  const settings = getSettings();
  const people = getPeople() as Person[];
  const sources = getSources() as CalendarSource[];

  const locale = settings.locale || 'en';
  const t = getLocaleData(locale);
  const timezone = settings.display_timezone || 'Europe/Oslo';
  const dateFormat = settings.date_format || 'dd/MM/yyyy';
  const rollingDays = parseInt(settings.rolling_days || '31', 10);
  const appName = settings.app_name || 'Family Calendar';

  if (!display) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{appName}</h1>
          <p className="text-gray-500 dark:text-gray-400">Display not found: /{params.slug}</p>
        </div>
      </div>
    );
  }

  return (
    <DisplayScreen
      displayId={display.id}
      initialViews={JSON.parse(display.views)}
      rotationIntervalSeconds={display.rotation_interval_seconds}
      people={people}
      sources={sources}
      t={t}
      locale={locale}
      timezone={timezone}
      dateFormat={dateFormat}
      rollingDays={rollingDays}
      appName={appName}
    />
  );
}
