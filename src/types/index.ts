export interface Person {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

export interface CalendarSource {
  id: string;
  person_id: string | null;
  person_ids: string[];
  name: string;
  type: 'ical_url' | 'ical_file';
  url?: string | null;
  file_path?: string | null;
  color?: string | null;
  last_fetched_at?: string | null;
}

export interface CalendarEvent {
  id: string;
  ical_uid?: string | null;
  source_id: string;
  person_id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  all_day: number;
  location?: string | null;
  description?: string | null;
}

export interface EventOverride {
  source_id: string;
  ical_uid: string;
  person_id: string;
}

export interface Settings {
  locale: string;
  refresh_interval_minutes: string;
  app_name: string;
  default_view: string;
  date_format: string;
  display_timezone: string;
  rolling_days: string;
}

export type ViewType = 'month' | 'week' | 'rolling' | 'agenda';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CalendarCell {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface GridRow {
  date: Date;
  weekNumber: number;
  dayName: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  cells: { [personId: string]: CalendarEvent[] };
}

export type Locale = 'en' | 'no';

export interface LocaleData {
  app: {
    name: string;
    loading: string;
    error: string;
  };
  nav: {
    calendar: string;
    settings: string;
    today: string;
    prev: string;
    next: string;
    all: string;
  };
  views: {
    month: string;
    week: string;
    rolling: string;
    agenda: string;
  };
  calendar: {
    weekNumber: string;
    noEvents: string;
    holiday: string;
    allDay: string;
    multiDay: string;
    continues: string;
  };
  days: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
    short: {
      monday: string;
      tuesday: string;
      wednesday: string;
      thursday: string;
      friday: string;
      saturday: string;
      sunday: string;
    };
  };
  months: {
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;
  };
  settings: {
    title: string;
    tabs: {
      people: string;
      calendars: string;
      display: string;
      about: string;
    };
    people: {
      title: string;
      addPerson: string;
      name: string;
      color: string;
      order: string;
      edit: string;
      delete: string;
      save: string;
      cancel: string;
      confirmDelete: string;
      moveUp: string;
      moveDown: string;
    };
    calendars: {
      title: string;
      addSource: string;
      sourceName: string;
      person: string;
      assignPeople: string;
      type: string;
      url: string;
      file: string;
      sourceColor: string;
      lastFetched: string;
      never: string;
      refresh: string;
      delete: string;
      confirmDelete: string;
      icalUrl: string;
      icalFile: string;
      dropzone: string;
      uploading: string;
      assignEvents: string;
      saveAssignments: string;
      savedAssignments: string;
      allPeople: string;
      noEventsToAssign: string;
      syncFirst: string;
      loadingEvents: string;
    };
    display: {
      title: string;
      appName: string;
      locale: string;
      localeEn: string;
      localeNo: string;
      refreshInterval: string;
      defaultView: string;
      dateFormat: string;
      timezone: string;
      rollingDays: string;
      save: string;
      saved: string;
    };
    about: {
      title: string;
      version: string;
      description: string;
    };
  };
  agenda: {
    today: string;
    tomorrow: string;
    noUpcoming: string;
    filterByPerson: string;
    all: string;
  };
}
