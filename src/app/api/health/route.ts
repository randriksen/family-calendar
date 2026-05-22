import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';

  try {
    const db = getDb();

    // Verify DB is reachable and has expected tables
    const { count: eventCount } = db
      .prepare('SELECT COUNT(*) as count FROM events')
      .get() as { count: number };

    const { count: peopleCount } = db
      .prepare('SELECT COUNT(*) as count FROM people')
      .get() as { count: number };

    return NextResponse.json(
      {
        status: 'ok',
        version,
        uptime,
        timestamp,
        db: { status: 'ok', events: eventCount, people: peopleCount },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      {
        status: 'error',
        version,
        uptime,
        timestamp,
        db: { status: 'error', error: message },
      },
      { status: 503 }
    );
  }
}
