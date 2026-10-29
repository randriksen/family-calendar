import type { CalendarEvent, CalendarSource, Person } from '@/types';

// Colour helpers shared by the interactive views (EventBadge) and the
// server-rendered lite mode. Kept free of 'use client' so route handlers can
// import them without pulling in a client component.

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

export function getTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#000';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#1f2937' : '#ffffff';
}

// Derive a pleasant, deterministic hex color from an arbitrary string.
// Used so shared-source events always render the same color regardless of person.
function hashToHex(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  const hue = hash % 360;
  const s = 0.55, l = 0.45;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toRgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const h = hue / 360;
  const r = Math.round(toRgb(h + 1 / 3) * 255);
  const g = Math.round(toRgb(h) * 255);
  const b = Math.round(toRgb(h - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// The colour a source imposes on its events, independent of any person.
// Returns null when the source defers to the person's colour.
export function getSourceColor(source: CalendarSource | undefined): string | null {
  if (source?.color) return source.color;
  // Shared source (multiple people) with no explicit color → deterministic source color
  // so the same event looks identical in every person's column
  if (source && source.person_ids && source.person_ids.length > 1) {
    return hashToHex(source.id);
  }
  return null;
}

export function getEventColor(
  event: CalendarEvent,
  sources: CalendarSource[],
  people: Person[]
): string {
  const sourceColor = getSourceColor(sources.find(s => s.id === event.source_id));
  if (sourceColor) return sourceColor;
  const person = people.find(p => p.id === event.person_id);
  return person?.color || '#6b7280';
}
