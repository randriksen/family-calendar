import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, getEventOverrides, setEventOverrides } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    return NextResponse.json(getEventOverrides(params.id));
  } catch (err) {
    console.error('[api/sources/[id]/overrides] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const body = await request.json();
    if (!Array.isArray(body.overrides)) {
      return NextResponse.json({ error: 'overrides must be an array' }, { status: 400 });
    }

    setEventOverrides(params.id, body.overrides);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/sources/[id]/overrides] PUT error:', err);
    return NextResponse.json({ error: 'Failed to set overrides' }, { status: 500 });
  }
}
