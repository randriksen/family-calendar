import type { LocaleData } from '@/types';
import enJson from '@/locales/en.json';
import noJson from '@/locales/no.json';

const locales: Record<string, LocaleData> = {
  en: enJson as LocaleData,
  no: noJson as LocaleData,
};

export function getLocaleData(locale: string): LocaleData {
  return locales[locale] || locales['en'];
}

export function t(locale: string, key: string): string {
  const data = getLocaleData(locale);
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = data;
  for (const part of parts) {
    if (current === undefined || current === null) return key;
    current = current[part];
  }
  if (typeof current === 'string') return current;
  return key;
}

export function getMonthName(locale: string, monthIndex: number): string {
  const keys = [
    'months.january', 'months.february', 'months.march', 'months.april',
    'months.may', 'months.june', 'months.july', 'months.august',
    'months.september', 'months.october', 'months.november', 'months.december'
  ];
  return t(locale, keys[monthIndex]);
}

export function getDayNames(locale: string, short = false): string[] {
  const prefix = short ? 'days.short.' : 'days.';
  // Week starts Monday
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return dayKeys.map(k => t(locale, prefix + k));
}

// Norwegian public holidays 2025–2027
export const norwegianHolidays: Record<string, string> = {
  // 2025 — Easter: April 20
  '2025-01-01': 'Nyttårsdag',
  '2025-04-17': 'Skjærtorsdag',
  '2025-04-18': 'Langfredag',
  '2025-04-20': '1. påskedag',
  '2025-04-21': '2. påskedag',
  '2025-05-01': 'Arbeidernes dag',
  '2025-05-17': 'Grunnlovsdag',
  '2025-05-29': 'Kristi himmelfartsdag',
  '2025-06-08': '1. pinsedag',
  '2025-06-09': '2. pinsedag',
  '2025-12-25': '1. juledag',
  '2025-12-26': '2. juledag',
  // 2026 — Easter: April 5
  '2026-01-01': 'Nyttårsdag',
  '2026-04-02': 'Skjærtorsdag',
  '2026-04-03': 'Langfredag',
  '2026-04-05': '1. påskedag',
  '2026-04-06': '2. påskedag',
  '2026-05-01': 'Arbeidernes dag',
  '2026-05-14': 'Kristi himmelfartsdag',
  '2026-05-17': 'Grunnlovsdag',
  '2026-05-24': '1. pinsedag',
  '2026-05-25': '2. pinsedag',
  '2026-12-25': '1. juledag',
  '2026-12-26': '2. juledag',
  // 2027 — Easter: March 28; Grunnlovsdag and 2. pinsedag both fall on May 17
  '2027-01-01': 'Nyttårsdag',
  '2027-03-25': 'Skjærtorsdag',
  '2027-03-26': 'Langfredag',
  '2027-03-28': '1. påskedag',
  '2027-03-29': '2. påskedag',
  '2027-05-01': 'Arbeidernes dag',
  '2027-05-06': 'Kristi himmelfartsdag',
  '2027-05-16': '1. pinsedag',
  '2027-05-17': 'Grunnlovsdag / 2. pinsedag',
  '2027-12-25': '1. juledag',
  '2027-12-26': '2. juledag',
};

export function getHoliday(locale: string, dateStr: string): string | null {
  if (locale !== 'no') return null;
  return norwegianHolidays[dateStr] || null;
}

export const availableLocales = [
  { code: 'en', label: 'English' },
  { code: 'no', label: 'Norsk (Bokmål)' },
];
