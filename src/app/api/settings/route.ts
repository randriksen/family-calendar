import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[api/settings] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      updates[key] = String(value);
    }

    updateSettings(updates);

    // Restart scheduler if refresh interval changed
    if ('refresh_interval_minutes' in updates) {
      const { restartScheduler } = await import('@/lib/scheduler');
      restartScheduler();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/settings] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
