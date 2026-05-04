import { getPeople, getSources, getSettings } from '@/lib/db';
import { getLocaleData } from '@/lib/i18n';
import CalendarView from '@/components/calendar/CalendarView';
import type { Person, CalendarSource, ViewType } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HomePage() {
  const people = getPeople() as Person[];
  const sources = getSources() as CalendarSource[];
  const settings = getSettings();
  const locale = settings.locale || 'no';
  const t = getLocaleData(locale);
  const defaultView = (settings.default_view as ViewType) || 'month';
  const appName = settings.app_name || t.app.name;
  const dateFormat = settings.date_format || 'dd/MM/yyyy';
  const timezone = settings.display_timezone || 'Europe/Oslo';
  const rollingDays = parseInt(settings.rolling_days || '31', 10);

  return (
    <CalendarView
      people={people}
      sources={sources}
      t={t}
      locale={locale}
      defaultView={defaultView}
      appName={appName}
      dateFormat={dateFormat}
      timezone={timezone}
      rollingDays={rollingDays}
    />
  );
}
