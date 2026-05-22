import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

// GET  — download a backup as a .db file
// POST — write a backup to BACKUP_PATH (for scripted / scheduled use)
async function createBackup(): Promise<{ data: Buffer; filename: string }> {
  const db = getDb();
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `family-calendar-${date}.db`;
  const tmpPath = path.join(os.tmpdir(), `fc-backup-${Date.now()}.db`);

  // better-sqlite3 backup() creates a consistent snapshot safe under concurrent reads/writes
  await db.backup(tmpPath);

  const data = await readFile(tmpPath);
  await unlink(tmpPath).catch(() => {});
  return { data, filename };
}

export async function GET() {
  try {
    const { data, filename } = await createBackup();

    // If BACKUP_PATH is configured, also persist a copy there
    await persistToBackupPath(data, filename);

    return new Response(new Blob([new Uint8Array(data)]), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(data.length),
      },
    });
  } catch (err) {
    console.error('[api/backup] GET error:', err);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const backupDir = process.env.BACKUP_PATH;
    if (!backupDir) {
      return NextResponse.json(
        { error: 'BACKUP_PATH is not configured' },
        { status: 400 }
      );
    }
    const { data, filename } = await createBackup();
    await persistToBackupPath(data, filename);
    return NextResponse.json({ ok: true, filename });
  } catch (err) {
    console.error('[api/backup] POST error:', err);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}

async function persistToBackupPath(data: Buffer, filename: string) {
  const backupDir = process.env.BACKUP_PATH;
  if (!backupDir) return;
  try {
    await mkdir(backupDir, { recursive: true });
    await writeFile(path.join(backupDir, filename), new Uint8Array(data));
    console.log(`[backup] Wrote ${filename} to ${backupDir}`);
  } catch (err) {
    console.error(`[backup] Failed to write to BACKUP_PATH (${backupDir}):`, err);
  }
}
