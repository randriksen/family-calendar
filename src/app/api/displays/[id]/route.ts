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
    const existing = getDisplayById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await request.json();
    const { name, slug, views, rotation_interval_seconds } = body;
    if (!name || typeof name !== 'string' || !name.trim())
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug))
      return NextResponse.json({ error: 'slug must be lowercase letters, numbers, hyphens' }, { status: 400 });
    updateDisplay(params.id, name.trim(), slug, Array.isArray(views) ? views : ['month'], rotation_interval_seconds ?? 0);
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
    const existing = getDisplayById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    deleteDisplay(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/displays/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete display' }, { status: 500 });
  }
}
