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
