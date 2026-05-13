import { NextRequest, NextResponse } from 'next/server';
import { getSources, createSource, getPersonById } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id') || undefined;
    const sources = getSources(personId);
    return NextResponse.json(sources);
  } catch (err) {
    console.error('[api/sources] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, url, file_path, color, sync_interval_minutes } = body;

    // Accept person_ids (array) or person_id (legacy single value)
    let person_ids: string[] = [];
    if (Array.isArray(body.person_ids) && body.person_ids.length > 0) {
      person_ids = body.person_ids;
    } else if (body.person_id) {
      person_ids = [body.person_id];
    }

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }
    if (!['ical_url', 'ical_file'].includes(type)) {
      return NextResponse.json({ error: 'type must be ical_url or ical_file' }, { status: 400 });
    }
    if (person_ids.length === 0) {
      return NextResponse.json({ error: 'at least one person must be assigned' }, { status: 400 });
    }
    for (const pid of person_ids) {
      if (!getPersonById(pid)) {
        return NextResponse.json({ error: `Person not found: ${pid}` }, { status: 404 });
      }
    }
    if (type === 'ical_url' && !url) {
      return NextResponse.json({ error: 'url is required for ical_url type' }, { status: 400 });
    }
    if (type === 'ical_file' && !file_path) {
      return NextResponse.json({ error: 'file_path is required for ical_file type' }, { status: 400 });
    }

    const intervalMinutes = sync_interval_minutes !== undefined ? parseInt(sync_interval_minutes, 10) : 240;
    const id = createSource({ name: name.trim(), type, url, file_path, color, person_ids, sync_interval_minutes: isNaN(intervalMinutes) ? 240 : intervalMinutes });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('[api/sources] POST error:', err);
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}
