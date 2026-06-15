# Big Screen & Passive Display Design

**Date:** 2026-06-15  
**Status:** Approved

## Overview

Two parallel tracks:

1. **Interactive big-screen upgrade** — the existing app scales up gracefully at large viewport sizes (≥1536px / 27"+ monitors) using Tailwind `2xl:` breakpoints. Same codebase, no new routes.
2. **Passive display screens** — a new `/display/[slug]` route renders a full-screen calendar for wall-mounted screens. Multiple named displays, each independently configured, managed from Settings → Screens.

## Track 1: Interactive Big-Screen Upgrade

### Goal

The existing app should be comfortable to use at 2560×1440 and 4K resolutions. Text must be larger, event chips more readable, and the layout must use the available horizontal space.

### Changes

**Header (`CalendarView.tsx`)**
- At `2xl:`: taller padding (`py-3` → `py-4`), larger app name (`text-base` → `text-xl`), larger nav buttons, larger icon buttons (`w-5 h-5` → `w-6 h-6`).

**Month / Week / Rolling views**
- At `2xl:`: event chips taller (min-height increase), font size up one step (`text-xs` → `text-sm`), show event start time alongside title in chips.
- Day-of-month numbers larger in month view headers.

**Day view (`SlotDayView.tsx`)**
- `HOUR_HEIGHT` increases from 64px to 96px at `2xl:` screen sizes (passed as a prop or derived from a CSS custom property).
- Time label font larger, event text larger, person column headers larger.

**General**
- No layout restructuring — the existing grid/flex structure is kept. Only spacing, font size, and element sizing change at the `2xl:` breakpoint.

## Track 2: Passive Display Screens

### Data Model

New SQLite table:

```sql
CREATE TABLE displays (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  views     TEXT NOT NULL DEFAULT '["month"]',  -- JSON array, e.g. ["month","week"]
  rotation_interval_seconds INTEGER NOT NULL DEFAULT 0,  -- 0 = no rotation
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

The `slug` is URL-safe (lowercase letters, numbers, hyphens). The `views` array lists one or more view names (`month`, `week`, `rolling`, `agenda`, `day`). When more than one view is listed and `rotation_interval_seconds > 0`, the display cycles through them automatically.

### API Routes

All routes live under `/api/displays`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/displays` | List all displays |
| POST | `/api/displays` | Create a display |
| GET | `/api/displays/[id]` | Get one display by id |
| PUT | `/api/displays/[id]` | Update a display |
| DELETE | `/api/displays/[id]` | Delete a display |

Display objects use `id` (UUID) as the primary key internally. The slug is exposed in URLs.

### Settings UI — Screens Tab

A new **Screens** tab is added to the existing Settings page (alongside People, Calendars, Display, About).

**Tab list view:**
- Each screen shown as a large tappable row: icon, name, summary (current view + URL slug), chevron.
- "+ Add Screen" button at the bottom.

**Per-screen detail view (navigates within the tab):**
- Back button returning to the list.
- Screen name (editable inline).
- URL slug (editable, auto-generated from name, validated as URL-safe).
- **Switch View**: 2×2 grid of large tap-target buttons — Month, Week, Day, Agenda (and Rolling). The active view is highlighted. Tapping immediately saves and takes effect on the display.
- **Rotation**: toggle to enable rotation; when on, shows a checklist of views to include and an interval selector (30s / 60s / 5min / 15min / 30min).
- **URL**: read-only display of the full URL; copy button.
- **Delete** button (with confirmation).

Locales (`en.json` / `no.json`): add a `settings.screens` section for all new labels.

### Display Route `/display/[slug]`

**Page structure:**
- Server component: fetches display config by slug, fetches app settings (locale, timezone, dateFormat, rollingDays, people, sources).
- Renders a full-screen client component `DisplayScreen`.

**`DisplayScreen` component:**
- No header nav, no settings/search/print/dark-mode buttons.
- **Top bar** (slim, same background as the app header):
  - Left: app name
  - Center: large live clock (HH:MM, updates every second)
  - Right: full date (e.g. "Sunday 15 June 2026")
- **Content area**: renders the appropriate view component (MonthView, WeekView, SlotDayView, AgendaView, RollingView) with the same props as the main app.
  - The content area is wrapped in a container with a `data-display` attribute. Track 1's `2xl:` Tailwind classes are duplicated as `[data-display] *:` equivalents (or the display page simply uses a forced viewport width of 1920px via a wrapping `min-w-screen` div) so the big-screen styles apply unconditionally regardless of actual browser viewport. Implementation detail to be resolved in the plan.
  - No person filter chips (shows all people unless a future per-display people filter is added).
- **Auto-refresh**: fetches new events every 60 seconds via client-side interval. Also re-fetches the display config (view/rotation settings) every 30 seconds so that a view change made from the phone in Settings takes effect on the wall screen within 30 seconds without a page reload.
- **View rotation**: if `rotation_interval_seconds > 0` and `views` has more than one entry, cycles through the view list on that interval using `setInterval`.
- **Error state**: if slug not found, shows a centered message with the app name and "Display not found".

### Locale Additions

Both `en.json` and `no.json` get a new `settings.screens` section:

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

Norwegian equivalents in `no.json`.

## What Is Not In Scope

- Per-display people filtering (show only specific people on a screen).
- Authentication / PIN protection for display screens.
- Weather widget or other non-calendar panels.
- QR code control companion (can be added later on top of this design).
- Kiosk / screensaver mode (prevent screen sleep) — this is a browser/OS concern.
