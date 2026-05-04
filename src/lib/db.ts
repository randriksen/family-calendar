import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'calendar.db');
const DATA_DIR = path.dirname(DB_PATH);
const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  // Migrate event_person_overrides:
  // v1 → v2: 2-column PK → 3-column PK
  // v2 → v3: drop FK on person_id so '__none__' sentinel is allowed
  try {
    const cols = db.prepare('PRAGMA table_info(event_person_overrides)').all() as Array<{ pk: number }>;
    if (cols.length > 0) {
      const pkCount = cols.filter(c => c.pk > 0).length;
      const fks = db.prepare('PRAGMA foreign_key_list(event_person_overrides)').all() as Array<{ from: string }>;
      const hasPersonFk = fks.some(fk => fk.from === 'person_id');
      if (pkCount < 3 || hasPersonFk) {
        // Preserve existing data then recreate without person_id FK
        const existing = pkCount >= 3
          ? (db.prepare('SELECT source_id, ical_uid, person_id FROM event_person_overrides').all() as Array<{ source_id: string; ical_uid: string; person_id: string }>)
          : [];
        db.exec('DROP TABLE IF EXISTS event_person_overrides');
        db.exec(`CREATE TABLE event_person_overrides (
          source_id TEXT NOT NULL,
          ical_uid  TEXT NOT NULL,
          person_id TEXT NOT NULL,
          PRIMARY KEY (source_id, ical_uid, person_id),
          FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
        )`);
        if (existing.length > 0) {
          const ins = db.prepare('INSERT OR IGNORE INTO event_person_overrides VALUES (?, ?, ?)');
          const tx = db.transaction(() => { existing.forEach(r => ins.run(r.source_id, r.ical_uid, r.person_id)); });
          tx();
        }
      }
    }
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS calendar_sources (
      id TEXT PRIMARY KEY,
      person_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      file_path TEXT,
      color TEXT,
      last_fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS source_people (
      source_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      PRIMARY KEY (source_id, person_id),
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      all_day INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      description TEXT,
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_person_overrides (
      source_id TEXT NOT NULL,
      ical_uid TEXT NOT NULL,
      person_id TEXT NOT NULL,
      PRIMARY KEY (source_id, ical_uid, person_id),
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_person_id ON events(person_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
    CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
    CREATE INDEX IF NOT EXISTS idx_sources_person_id ON calendar_sources(person_id);
  `);

  // Add ical_uid column if missing (migration for existing DBs)
  const eventCols = db.prepare('PRAGMA table_info(events)').all() as Array<{ name: string }>;
  if (!eventCols.find(c => c.name === 'ical_uid')) {
    db.exec('ALTER TABLE events ADD COLUMN ical_uid TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_ical_uid ON events(source_id, ical_uid)');
  }

  // Add photo_url column to people if missing
  const peopleCols = db.prepare('PRAGMA table_info(people)').all() as Array<{ name: string }>;
  if (!peopleCols.find(c => c.name === 'photo_url')) {
    db.exec('ALTER TABLE people ADD COLUMN photo_url TEXT');
  }

  // Migrate existing calendar_sources.person_id → source_people
  const spCount = (db.prepare('SELECT COUNT(*) as count FROM source_people').get() as { count: number }).count;
  if (spCount === 0) {
    const existing = db.prepare('SELECT id, person_id FROM calendar_sources WHERE person_id IS NOT NULL').all() as Array<{ id: string; person_id: string }>;
    if (existing.length > 0) {
      const ins = db.prepare('INSERT OR IGNORE INTO source_people (source_id, person_id) VALUES (?, ?)');
      const tx = db.transaction(() => { existing.forEach(s => ins.run(s.id, s.person_id)); });
      tx();
    }
  }

  // Seed default settings
  const settingsCount = (db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }).count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const insertMany = db.transaction(() => {
      insertSetting.run('locale', 'en');
      insertSetting.run('refresh_interval_minutes', '60');
      insertSetting.run('app_name', 'Family Calendar');
      insertSetting.run('default_view', 'rolling');
      insertSetting.run('date_format', 'dd/MM/yyyy');
      insertSetting.run('display_timezone', 'Europe/Oslo');
      insertSetting.run('rolling_days', '31');
    });
    insertMany();
  } else {
    // Migrate: add any missing settings keys for existing installs
    const upsertIfMissing = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    upsertIfMissing.run('date_format', 'dd/MM/yyyy');
    upsertIfMissing.run('display_timezone', 'Europe/Oslo');
    upsertIfMissing.run('rolling_days', '31');
  }
}

// ── People ────────────────────────────────────────────────────────────────────

export function getPeople() {
  const db = getDb();
  return db.prepare('SELECT * FROM people ORDER BY display_order ASC, name ASC').all();
}

export function getPersonById(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM people WHERE id = ?').get(id);
}

export function createPerson(name: string, color: string, photo_url?: string) {
  const db = getDb();
  const id = uuidv4();
  const maxOrder = (db.prepare('SELECT MAX(display_order) as max FROM people').get() as { max: number | null }).max ?? -1;
  db.prepare('INSERT INTO people (id, name, color, display_order, photo_url) VALUES (?, ?, ?, ?, ?)').run(
    id, name, color, maxOrder + 1, photo_url ?? null
  );
  return id;
}

export function updatePerson(id: string, updates: { name?: string; color?: string; display_order?: number; photo_url?: string | null }) {
  const db = getDb();
  const fields = Object.entries(updates).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
  if (fields.length === 0) return;
  const values = Object.entries(updates).filter(([, v]) => v !== undefined).map(([, v]) => v);
  db.prepare(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
}

export function deletePerson(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM people WHERE id = ?').run(id);
}

export function reorderPeople(orderedIds: string[]) {
  const db = getDb();
  const update = db.prepare('UPDATE people SET display_order = ? WHERE id = ?');
  const tx = db.transaction(() => { orderedIds.forEach((id, index) => update.run(index, id)); });
  tx();
}

// ── Source People (junction) ──────────────────────────────────────────────────

export function getSourcePeople(sourceId: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT person_id FROM source_people WHERE source_id = ?').all(sourceId) as Array<{ person_id: string }>;
  return rows.map(r => r.person_id);
}

export function setSourcePeople(sourceId: string, personIds: string[]) {
  const db = getDb();
  const del = db.prepare('DELETE FROM source_people WHERE source_id = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO source_people (source_id, person_id) VALUES (?, ?)');
  const tx = db.transaction(() => {
    del.run(sourceId);
    personIds.forEach(pid => ins.run(sourceId, pid));
  });
  tx();
}

// ── Calendar Sources ──────────────────────────────────────────────────────────

function attachPersonIds(db: Database.Database, sources: Record<string, unknown>[]): unknown[] {
  const stmt = db.prepare('SELECT person_id FROM source_people WHERE source_id = ?');
  return sources.map(s => ({
    ...s,
    person_ids: (stmt.all(s.id as string) as Array<{ person_id: string }>).map(r => r.person_id),
  }));
}

export function getSources(personId?: string) {
  const db = getDb();
  let sources: Record<string, unknown>[];
  if (personId) {
    sources = db.prepare(`
      SELECT DISTINCT cs.* FROM calendar_sources cs
      INNER JOIN source_people sp ON sp.source_id = cs.id
      WHERE sp.person_id = ?
      ORDER BY cs.name ASC
    `).all(personId) as Record<string, unknown>[];
  } else {
    sources = db.prepare('SELECT * FROM calendar_sources ORDER BY name ASC').all() as Record<string, unknown>[];
  }
  return attachPersonIds(db, sources);
}

export function getSourceById(id: string) {
  const db = getDb();
  const source = db.prepare('SELECT * FROM calendar_sources WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!source) return null;
  return attachPersonIds(db, [source])[0];
}

export function createSource(data: {
  name: string;
  type: 'ical_url' | 'ical_file';
  url?: string;
  file_path?: string;
  color?: string;
  person_ids: string[];
}) {
  const db = getDb();
  const id = uuidv4();
  const primaryPersonId = data.person_ids[0] ?? null;
  db.prepare(
    'INSERT INTO calendar_sources (id, person_id, name, type, url, file_path, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, primaryPersonId, data.name, data.type, data.url ?? null, data.file_path ?? null, data.color ?? null);
  setSourcePeople(id, data.person_ids);
  return id;
}

export function updateSource(id: string, updates: Partial<{
  name: string;
  url: string;
  file_path: string;
  color: string;
  last_fetched_at: string;
  person_ids: string[];
}>) {
  const db = getDb();
  const { person_ids, ...rest } = updates;

  if (person_ids !== undefined) {
    setSourcePeople(id, person_ids);
    // Keep person_id in sync with first assigned person
    const primaryPersonId = person_ids[0] ?? null;
    db.prepare('UPDATE calendar_sources SET person_id = ? WHERE id = ?').run(primaryPersonId, id);
  }

  const fields = Object.entries(rest).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
  if (fields.length > 0) {
    const values = Object.entries(rest).filter(([, v]) => v !== undefined).map(([, v]) => v);
    db.prepare(`UPDATE calendar_sources SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  }
}

export function deleteSource(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM calendar_sources WHERE id = ?').run(id);
}

// ── Event Person Overrides ────────────────────────────────────────────────────

export function getEventOverrides(sourceId: string): Array<{ ical_uid: string; person_id: string }> {
  const db = getDb();
  return db.prepare('SELECT ical_uid, person_id FROM event_person_overrides WHERE source_id = ?').all(sourceId) as Array<{ ical_uid: string; person_id: string }>;
}

export function setEventOverrides(sourceId: string, overrides: Array<{ ical_uid: string; person_id: string }>) {
  const db = getDb();
  const del = db.prepare('DELETE FROM event_person_overrides WHERE source_id = ?');
  const ins = db.prepare('INSERT OR REPLACE INTO event_person_overrides (source_id, ical_uid, person_id) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    del.run(sourceId);
    overrides.forEach(o => ins.run(sourceId, o.ical_uid, o.person_id));
  });
  tx();
}

/**
 * Immediately apply overrides to the events table so changes are visible without
 * a full iCal re-sync. For each overridden (source_id, ical_uid), event rows for
 * people NOT in the override list are deleted.
 * NOTE: Removing an override (setting back to All) restores events on the next sync.
 */
export function applyOverridesToEvents(sourceId: string): void {
  const db = getDb();
  db.prepare(`
    DELETE FROM events
    WHERE source_id = ?
      AND ical_uid IS NOT NULL
      AND ical_uid IN (
        SELECT DISTINCT ical_uid FROM event_person_overrides WHERE source_id = ?
      )
      AND person_id NOT IN (
        SELECT person_id FROM event_person_overrides
        WHERE source_id = ? AND ical_uid = events.ical_uid
      )
  `).run(sourceId, sourceId, sourceId);
}

// ── Events ────────────────────────────────────────────────────────────────────

export function getEvents(startDate: string, endDate: string, personIds?: string[]) {
  const db = getDb();

  // Override filter: if an override exists for (source_id, ical_uid), only show the
  // event rows whose person_id appears in that override set. Events with no override
  // (or no ical_uid) are shown for all people as normal.
  const overrideClause = `
    AND (
      e.ical_uid IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM event_person_overrides o
        WHERE o.source_id = e.source_id AND o.ical_uid = e.ical_uid
      )
      OR EXISTS (
        SELECT 1 FROM event_person_overrides o
        WHERE o.source_id = e.source_id AND o.ical_uid = e.ical_uid AND o.person_id = e.person_id
      )
    )`;

  if (personIds && personIds.length > 0) {
    const placeholders = personIds.map(() => '?').join(', ');
    return db.prepare(
      `SELECT e.* FROM events e
       WHERE e.start_date <= ? AND (e.end_date >= ? OR (e.end_date IS NULL AND e.start_date >= ?))
       AND e.person_id IN (${placeholders})
       ${overrideClause}
       ORDER BY e.start_date ASC`
    ).all(endDate, startDate, startDate, ...personIds);
  }
  return db.prepare(
    `SELECT e.* FROM events e
     WHERE e.start_date <= ? AND (e.end_date >= ? OR (e.end_date IS NULL AND e.start_date >= ?))
     ${overrideClause}
     ORDER BY e.start_date ASC`
  ).all(endDate, startDate, startDate);
}

export function getEventsBySource(sourceId: string): Array<{
  ical_uid: string;
  title: string;
  start_date: string;
  all_day: number;
  person_ids: string;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT ical_uid, title, MIN(start_date) as start_date, all_day,
           GROUP_CONCAT(DISTINCT person_id) as person_ids
    FROM events
    WHERE source_id = ? AND ical_uid IS NOT NULL
    GROUP BY ical_uid
    ORDER BY MIN(start_date) ASC
    LIMIT 300
  `).all(sourceId) as Array<{ ical_uid: string; title: string; start_date: string; all_day: number; person_ids: string }>;
}

export function deleteEventsBySource(sourceId: string) {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE source_id = ?').run(sourceId);
}

export function insertEvents(events: Array<{
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
}>) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO events (id, ical_uid, source_id, person_id, title, start_date, end_date, all_day, location, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const evt of events) {
      insert.run(
        evt.id, evt.ical_uid ?? null, evt.source_id, evt.person_id, evt.title,
        evt.start_date, evt.end_date ?? null, evt.all_day,
        evt.location ?? null, evt.description ?? null
      );
    }
  });
  tx();
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function updateSettings(updates: Record<string, string>) {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, value);
    }
  });
  tx();
}

export { UPLOADS_PATH };
