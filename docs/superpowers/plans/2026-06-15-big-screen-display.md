# Big Screen & Passive Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale the interactive app up for 27"+ screens and add a `/display/[slug]` passive wall-calendar route with per-screen configuration in Settings.

**Architecture:** Two tracks implemented in sequence. Track 1 adds Tailwind `2xl:` responsive classes throughout existing components and a dynamic `hourHeight` prop for the day view. Track 2 adds a `displays` SQLite table, full CRUD API, a Screens settings tab, and a new server-rendered `/display/[slug]` route backed by a client component that auto-refreshes and optionally rotates views.

**Tech Stack:** Next.js 14 App Router, better-sqlite3, Tailwind CSS, date-fns, TypeScript

---

## File Map

**Created:**
- `src/app/api/displays/route.ts` — GET list / POST create
- `src/app/api/displays/[id]/route.ts` — GET / PUT / DELETE by id
- `src/app/display/[slug]/page.tsx` — server component, reads DB + settings
- `src/components/display/DisplayScreen.tsx` — client component, full-screen display
- `src/components/settings/ScreensSettings.tsx` — Screens tab in Settings

**Modified:**
- `src/lib/db.ts` — add displays table migration + 6 CRUD functions
- `src/types/index.ts` — add `Display` interface + `screens` to `LocaleData`
- `src/locales/en.json` — add `settings.tabs.screens` + `settings.screens`
- `src/locales/no.json` — same in Norwegian
- `src/app/settings/page.tsx` — wire in Screens tab
- `src/components/calendar/CalendarView.tsx` — `2xl:` header classes + `hourHeight` state
- `src/components/calendar/EventBadge.tsx` — `2xl:` text/padding classes
- `src/components/calendar/SlotDayView.tsx` — accept `hourHeight` prop

---

## Task 1: DB — displays table + CRUD

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add displays table to `initSchema`**

In `src/lib/db.ts`, inside `initSchema`, add after the existing `CREATE TABLE IF NOT EXISTS settings` block and before `CREATE INDEX` lines:

```typescript
  db.exec(`
    CREATE TABLE IF NOT EXISTS displays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      views TEXT NOT NULL DEFAULT '["month"]',
      rotation_interval_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
```

- [ ] **Step 2: Add CRUD functions**

At the end of `src/lib/db.ts`, add:

```typescript
// ── Displays ──────────────────────────────────────────────────────────────────

export interface DisplayRow {
  id: string;
  name: string;
  slug: string;
  views: string; // JSON-encoded string[]
  rotation_interval_seconds: number;
  created_at: string;
}

export function getDisplays(): DisplayRow[] {
  return getDb().prepare('SELECT * FROM displays ORDER BY created_at ASC').all() as DisplayRow[];
}

export function getDisplayById(id: string): DisplayRow | null {
  return (getDb().prepare('SELECT * FROM displays WHERE id = ?').get(id) as DisplayRow) ?? null;
}

export function getDisplayBySlug(slug: string): DisplayRow | null {
  return (getDb().prepare('SELECT * FROM displays WHERE slug = ?').get(slug) as DisplayRow) ?? null;
}

export function createDisplay(name: string, slug: string, views: string[], rotationIntervalSeconds: number): string {
  const id = uuidv4();
  getDb()
    .prepare('INSERT INTO displays (id, name, slug, views, rotation_interval_seconds) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, slug, JSON.stringify(views), rotationIntervalSeconds);
  return id;
}

export function updateDisplay(id: string, name: string, slug: string, views: string[], rotationIntervalSeconds: number): void {
  getDb()
    .prepare('UPDATE displays SET name=?, slug=?, views=?, rotation_interval_seconds=? WHERE id=?')
    .run(name, slug, JSON.stringify(views), rotationIntervalSeconds, id);
}

export function deleteDisplay(id: string): void {
  getDb().prepare('DELETE FROM displays WHERE id=?').run(id);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/ole/family-calendar && npm run build 2>&1 | tail -20
```

Expected: build succeeds (or only pre-existing errors, none new).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add displays table and CRUD to db"
```

---

## Task 2: Types + Locales

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/locales/en.json`
- Modify: `src/locales/no.json`

- [ ] **Step 1: Add `Display` type to `src/types/index.ts`**

After the `Settings` interface, add:

```typescript
export interface Display {
  id: string;
  name: string;
  slug: string;
  views: string[];
  rotation_interval_seconds: number;
  created_at: string;
}
```

- [ ] **Step 2: Add `screens` to `LocaleData` in `src/types/index.ts`**

In the `LocaleData` interface, add `screens:` to the `settings.tabs` block and add a new `screens:` block:

```typescript
// Inside settings.tabs add:
screens: string;

// Add new top-level property inside settings:
screens: {
  title: string;
  addScreen: string;
  noScreens: string;
  name: string;
  slug: string;
  url: string;
  copyUrl: string;
  copied: string;
  currentView: string;
  rotation: string;
  rotationInterval: string;
  delete: string;
  confirmDelete: string;
  save: string;
  cancel: string;
};
```

The full updated `settings` section in `LocaleData` should have `tabs.screens: string` and a `screens: { ... }` block as a sibling to `people`, `calendars`, `display`, `about`.

- [ ] **Step 3: Add English strings to `src/locales/en.json`**

Add `"screens"` to the `"tabs"` object and add a top-level `"screens"` key inside `"settings"`:

```json
"tabs": {
  "people": "People",
  "calendars": "Calendars",
  "display": "Display",
  "about": "About",
  "screens": "Screens"
},
```

```json
"screens": {
  "title": "Display Screens",
  "addScreen": "Add Screen",
  "noScreens": "No display screens yet",
  "name": "Name",
  "slug": "URL slug",
  "url": "URL",
  "copyUrl": "Copy URL",
  "copied": "Copied!",
  "currentView": "Current View",
  "rotation": "Rotate through views",
  "rotationInterval": "Switch every",
  "delete": "Delete",
  "confirmDelete": "Delete this display screen?",
  "save": "Save",
  "cancel": "Cancel"
}
```

- [ ] **Step 4: Add Norwegian strings to `src/locales/no.json`**

```json
"tabs": {
  ...existing...,
  "screens": "Skjermer"
},
"screens": {
  "title": "Visningsskjermer",
  "addScreen": "Legg til skjerm",
  "noScreens": "Ingen visningsskjermer ennå",
  "name": "Navn",
  "slug": "URL-slug",
  "url": "URL",
  "copyUrl": "Kopier URL",
  "copied": "Kopiert!",
  "currentView": "Gjeldende visning",
  "rotation": "Roter mellom visninger",
  "rotationInterval": "Bytt hvert",
  "delete": "Slett",
  "confirmDelete": "Slette denne visningsskjermen?",
  "save": "Lagre",
  "cancel": "Avbryt"
}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no new TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/locales/en.json src/locales/no.json
git commit -m "feat: add Display type and screens locale strings"
```

---

## Task 3: API Routes

**Files:**
- Create: `src/app/api/displays/route.ts`
- Create: `src/app/api/displays/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/displays/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDisplays, createDisplay, getDisplayBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    if (slug) {
      const d = getDisplayBySlug(slug);
      if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...d, views: JSON.parse(d.views) });
    }
    const displays = getDisplays().map(d => ({ ...d, views: JSON.parse(d.views) }));
    return NextResponse.json(displays);
  } catch (err) {
    console.error('[api/displays] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch displays' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, views, rotation_interval_seconds } = body;
    if (!name || typeof name !== 'string' || !name.trim())
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug))
      return NextResponse.json({ error: 'slug must be lowercase letters, numbers, hyphens' }, { status: 400 });
    const id = createDisplay(name.trim(), slug, Array.isArray(views) ? views : ['month'], rotation_interval_seconds ?? 0);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE'))
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    console.error('[api/displays] POST error:', err);
    return NextResponse.json({ error: 'Failed to create display' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/displays/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDisplayById, updateDisplay, deleteDisplay } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const d = getDisplayById(params.id);
    if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...d, views: JSON.parse(d.views) });
  } catch (err) {
    console.error('[api/displays/[id]] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch display' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, slug, views, rotation_interval_seconds } = body;
    if (!name || !slug)
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    updateDisplay(params.id, name, slug, Array.isArray(views) ? views : ['month'], rotation_interval_seconds ?? 0);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE'))
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    console.error('[api/displays/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update display' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    deleteDisplay(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/displays/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete display' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Smoke-test the API (server must be running)**

```bash
# Create a display
curl -s -X POST http://localhost:3000/api/displays \
  -H "Content-Type: application/json" \
  -d '{"name":"Living Room","slug":"living-room","views":["month"],"rotation_interval_seconds":0}' | python3 -m json.tool

# List displays
curl -s http://localhost:3000/api/displays | python3 -m json.tool
```

Expected: POST returns `{"id":"<uuid>"}`, GET returns array with the display.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/displays/
git commit -m "feat: add /api/displays CRUD routes"
```

---

## Task 4: ScreensSettings Component

**Files:**
- Create: `src/components/settings/ScreensSettings.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/ScreensSettings.tsx
git commit -m "feat: add ScreensSettings component"
```

---

## Task 5: Wire Screens Tab into Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Import ScreensSettings**

Add to the imports at the top of `src/app/settings/page.tsx`:

```typescript
import ScreensSettings from '@/components/settings/ScreensSettings';
```

- [ ] **Step 2: Update the `Tab` type**

Change line:
```typescript
type Tab = 'people' | 'calendars' | 'display' | 'about';
```
to:
```typescript
type Tab = 'people' | 'calendars' | 'display' | 'screens' | 'about';
```

- [ ] **Step 3: Add Screens tab to the tabs array**

The tabs array currently ends with `display` and `about`. Insert `screens` between them:

```typescript
const tabs: { id: Tab; label: string }[] = [
  { id: 'people',    label: t.settings.tabs.people },
  { id: 'calendars', label: t.settings.tabs.calendars },
  { id: 'display',   label: t.settings.tabs.display },
  { id: 'screens',   label: t.settings.tabs.screens },
  { id: 'about',     label: t.settings.tabs.about },
];
```

- [ ] **Step 4: Add render block**

Inside the `<main>` element, after the `{activeTab === 'display' && ...}` block, add:

```tsx
{activeTab === 'screens' && (
  <ScreensSettings t={t} />
)}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Manual test**

With the dev server running, navigate to `http://localhost:3000/settings`. Confirm a "Screens" tab appears. Click it, add a screen named "Living Room" with slug "living-room", save it, verify it appears in the list.

- [ ] **Step 7: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add Screens tab to settings page"
```

---

## Task 6: Display Route — Server Component

**Files:**
- Create: `src/app/display/[slug]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { getDisplayBySlug, getPeople, getSources, getSettings } from '@/lib/db';
import { getLocaleData } from '@/lib/i18n';
import DisplayScreen from '@/components/display/DisplayScreen';

export default function DisplayPage({ params }: { params: { slug: string } }) {
  const display = getDisplayBySlug(params.slug);
  const settings = getSettings();
  const people = getPeople();
  const sources = getSources();

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
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: will fail on missing `DisplayScreen` import — that's expected, proceed to Task 7.

- [ ] **Step 3: Commit (after Task 7 build passes)**

Defer this commit to after Task 7.

---

## Task 7: DisplayScreen Client Component

**Files:**
- Create: `src/components/display/DisplayScreen.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import type { CalendarEvent, CalendarSource, Person, LocaleData, ViewType, Display } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import RollingView from '@/components/calendar/RollingView';
import AgendaView from '@/components/calendar/AgendaView';
import SlotDayView from '@/components/calendar/SlotDayView';

interface DisplayScreenProps {
  displayId: string;
  initialViews: string[];
  rotationIntervalSeconds: number;
  people: Person[];
  sources: CalendarSource[];
  t: LocaleData;
  locale: string;
  timezone: string;
  dateFormat: string;
  rollingDays: number;
  appName: string;
}

function getEventRange(view: ViewType, date: Date, rollingDays: number): { start: Date; end: Date } {
  switch (view) {
    case 'month':  return { start: startOfMonth(date), end: endOfMonth(date) };
    case 'week':   return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'day':    return { start: addDays(date, -1), end: addDays(date, 1) };
    case 'agenda': return { start: date, end: addDays(date, 90) };
    case 'rolling':
    default:       return { start: addDays(date, -90), end: addDays(date, rollingDays + 90) };
  }
}

function LiveClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now));
      setDateStr(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timezone]);

  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400" />
      <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100 absolute left-1/2 -translate-x-1/2">{time}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{dateStr}</span>
    </div>
  );
}

export default function DisplayScreen({
  displayId, initialViews, rotationIntervalSeconds,
  people, sources, t, locale, timezone, dateFormat, rollingDays, appName,
}: DisplayScreenProps) {
  const [views, setViews] = useState<string[]>(initialViews);
  const [viewIndex, setViewIndex] = useState(0);
  const [date] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const currentView = (views[viewIndex] ?? 'month') as ViewType;

  const fetchEvents = useCallback(async (v: ViewType) => {
    const { start, end } = getEventRange(v, date, rollingDays);
    try {
      const res = await fetch(`/api/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (res.ok) setEvents(await res.json());
    } catch { /* ignore */ }
  }, [date, rollingDays]);

  // Initial + recurring event fetch
  useEffect(() => {
    fetchEvents(currentView);
    const id = setInterval(() => fetchEvents(currentView), 60_000);
    return () => clearInterval(id);
  }, [currentView, fetchEvents]);

  // Re-fetch display config every 30s so view changes from Settings take effect
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/displays/${displayId}`);
        if (res.ok) {
          const d: Display = await res.json();
          setViews(d.views);
        }
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [displayId]);

  // View rotation
  useEffect(() => {
    if (rotationIntervalSeconds <= 0 || views.length <= 1) return;
    const id = setInterval(() => {
      setViewIndex(i => (i + 1) % views.length);
    }, rotationIntervalSeconds * 1000);
    return () => clearInterval(id);
  }, [rotationIntervalSeconds, views.length]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center relative shadow-sm">
        <span className="text-base font-bold text-gray-900 dark:text-gray-100">{appName}</span>
        <LiveClock timezone={timezone} />
      </header>

      {/* Calendar content */}
      <main className="flex-1 overflow-hidden">
        {currentView === 'month' && (
          <MonthView date={date} events={events} sources={sources} people={people} t={t} locale={locale} timezone={timezone} />
        )}
        {currentView === 'week' && (
          <WeekView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} />
        )}
        {currentView === 'rolling' && (
          <RollingView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} rollingDays={rollingDays} />
        )}
        {currentView === 'agenda' && (
          <AgendaView date={date} events={events} sources={sources} people={people} t={t} locale={locale} timezone={timezone} />
        )}
        {currentView === 'day' && (
          <SlotDayView date={date} events={events} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 3: Manual test**

1. Navigate to `http://localhost:3000/settings` → Screens tab → add a screen "Living Room" with slug "living-room", view "Month", save.
2. Navigate to `http://localhost:3000/display/living-room`.
3. Verify: full-screen month view, top bar with app name and live clock.
4. Back in Settings, change the view to "Week", navigate back to the display — within 30 seconds it should switch.

- [ ] **Step 4: Commit**

```bash
git add src/app/display/ src/components/display/
git commit -m "feat: add /display/[slug] passive display route"
```

---

## Task 8: Track 1 — Big-Screen Responsive Upgrade

**Files:**
- Modify: `src/components/calendar/EventBadge.tsx`
- Modify: `src/components/calendar/MonthView.tsx`
- Modify: `src/components/calendar/SlotDayView.tsx`
- Modify: `src/components/calendar/CalendarView.tsx`

- [ ] **Step 1: Scale up EventBadge at `2xl:`**

In `src/components/calendar/EventBadge.tsx`, change the main badge `className` on the outer `<div>` (the `flex flex-col px-1.5 py-0.5 ... text-xs` one) to:

```typescript
className={`flex flex-col px-1.5 py-0.5 2xl:px-2 2xl:py-1 ${roundedClass} text-xs 2xl:text-sm w-full cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${isSingleAllDay ? 'font-semibold shadow-sm' : 'font-medium'}`}
```

Also scale the location line font size — change the inline style `fontSize: '0.65rem'` to a className instead:

```typescript
<div className="truncate opacity-75 font-normal text-[0.65rem] 2xl:text-xs" >
  📍 {event.location}
</div>
```

(Remove the `style={{ fontSize: '0.65rem' }}` inline style.)

- [ ] **Step 2: Scale up MonthView day numbers and person headers at `2xl:`**

In `src/components/calendar/MonthView.tsx`:

Person name in sticky header (line ~157):
```tsx
<span className="font-bold text-xs 2xl:text-sm truncate w-full text-center" style={{ color: person.color }}>
```

Person photo in sticky header (line ~155):
```tsx
<img src={person.photo_url} alt={person.name} className="w-7 h-7 2xl:w-9 2xl:h-9 rounded-full mx-auto mb-0.5 object-cover" />
```

Day number circle in the left gutter (line ~211):
```tsx
<span
  className={`text-sm 2xl:text-base font-bold leading-none w-7 h-7 2xl:w-9 2xl:h-9 flex items-center justify-center rounded-full ${
    today ? 'bg-blue-600 text-white' : ''
  }`}
>
```

Short day name below the number (line ~217):
```tsx
<span className="text-[10px] 2xl:text-xs leading-none mt-0.5 font-medium">
```

Week number label (line ~204):
```tsx
<span className="text-[10px] 2xl:text-xs font-medium text-gray-300 dark:text-gray-600 leading-none mb-0.5">
```

- [ ] **Step 4: Make HOUR_HEIGHT configurable in SlotDayView**

In `src/components/calendar/SlotDayView.tsx`:

Change the constant at the top from:
```typescript
const HOUR_HEIGHT = 64; // px — 4rem, 1px ≈ 0.9375 minutes
```
to:
```typescript
const DEFAULT_HOUR_HEIGHT = 64;
```

Add `hourHeight?: number` to `SlotDayViewProps`:
```typescript
interface SlotDayViewProps {
  // ... existing props ...
  hourHeight?: number;
}
```

Update the function signature to destructure it with a default:
```typescript
export default function SlotDayView({
  date, events, sources, people, t, locale, dateFormat, timezone, onEventClick, singlePersonId, hourHeight = DEFAULT_HOUR_HEIGHT,
}: SlotDayViewProps) {
```

Replace the three derived constants that use `HOUR_HEIGHT` with computed versions:
```typescript
const PX_PER_MIN = hourHeight / 60;
const TOTAL_H    = hourHeight * 24;
```

(The existing `const PX_PER_MIN = HOUR_HEIGHT / 60;` and `const TOTAL_H = HOUR_HEIGHT * 24;` lines — replace `HOUR_HEIGHT` with `hourHeight` in both.)

- [ ] **Step 5: Add hourHeight state to CalendarView**

In `src/components/calendar/CalendarView.tsx`, add a `hourHeight` state that tracks screen width:

After the existing state declarations (around line 184), add:

```typescript
const [hourHeight, setHourHeight] = useState(64);
useEffect(() => {
  const update = () => setHourHeight(window.innerWidth >= 1536 ? 96 : 64);
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}, []);
```

Then pass it to SlotDayView in the render:
```tsx
{view === 'day' && (
  <SlotDayView date={date} events={filteredEvents} sources={sources} people={people} t={t} locale={locale} dateFormat={dateFormat} timezone={timezone} onEventClick={setSelectedEvent} singlePersonId={selectedPerson ?? undefined} hourHeight={hourHeight} />
)}
```

- [ ] **Step 6: Scale up the header in CalendarView**

In the `<header>` element in `CalendarView.tsx`, apply `2xl:` size upgrades:

```tsx
<header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 py-2 2xl:px-5 2xl:py-3 flex items-center gap-2 2xl:gap-3 shadow-sm z-20">
```

The app name `<h1>`:
```tsx
<h1 className="text-base 2xl:text-xl font-bold text-gray-900 dark:text-gray-100 hidden sm:block mr-2 shrink-0">
```

The nav `<svg>` icons (prev/next arrows):
```tsx
<svg className="w-4 h-4 2xl:w-5 2xl:h-5" ...>
```

The date label `<span>`:
```tsx
<span className="text-sm 2xl:text-base font-semibold text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
```

The view switcher buttons in the desktop `div`:
```tsx
<button className={`px-3 py-1 2xl:px-4 2xl:py-1.5 rounded-md text-sm 2xl:text-base font-medium transition-all ${...}`}>
```

Icon buttons (search, print, dark mode, settings — each `p-1.5`):
```tsx
className="p-1.5 2xl:p-2 ..."
```

Their SVGs (`w-5 h-5`):
```tsx
className="w-5 h-5 2xl:w-6 2xl:h-6"
```

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 8: Visual check at large viewport**

Open `http://localhost:3000` in the browser, use DevTools to set viewport to 1920×1080 (or open on actual large monitor), confirm:
- Header is taller with larger text and buttons
- Event badges in month/week view show slightly larger text
- Day view has taller hour rows (96px vs 64px)

- [ ] **Step 9: Commit**

```bash
git add src/components/calendar/EventBadge.tsx src/components/calendar/MonthView.tsx src/components/calendar/SlotDayView.tsx src/components/calendar/CalendarView.tsx
git commit -m "feat: scale up interactive app at 2xl breakpoint"
```

---

## Task 9: Final Build & Smoke Test

- [ ] **Step 1: Full production build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Verify display route with bad slug**

```bash
curl -s http://localhost:3000/display/does-not-exist | grep -o "Display not found"
```

Expected: `Display not found`

- [ ] **Step 3: End-to-end flow**

1. Go to Settings → Screens → Add Screen: name "Test", slug "test", view "Month" → Save.
2. Open `http://localhost:3000/display/test` — confirm full-screen month view with clock in top bar.
3. Back in Settings → Screens → click "Test" → switch view to "Week" → Save.
4. Watch the display URL — within 30 seconds it switches to Week view without page reload.
5. Delete the test screen from Settings.

- [ ] **Step 4: Commit and tag**

```bash
git add -A
git commit -m "feat: big screen upgrade and passive display screens complete"
```
