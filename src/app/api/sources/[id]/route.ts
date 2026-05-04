import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, updateSource, deleteSource, getPersonById } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    return NextResponse.json(source);
  } catch (err) {
    console.error('[api/sources/[id]] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch source' }, { status: 500 });
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
    const updates: Parameters<typeof updateSource>[1] = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.url !== undefined) updates.url = body.url;
    if (body.file_path !== undefined) updates.file_path = body.file_path;
    if (body.color !== undefined) updates.color = body.color;

    if (Array.isArray(body.person_ids)) {
      for (const pid of body.person_ids) {
        if (!getPersonById(pid)) {
          return NextResponse.json({ error: `Person not found: ${pid}` }, { status: 404 });
        }
      }
      updates.person_ids = body.person_ids;
    }

    updateSource(params.id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/sources/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const source = getSourceById(params.id);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    deleteSource(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/sources/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}
