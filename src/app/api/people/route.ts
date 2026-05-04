import { NextRequest, NextResponse } from 'next/server';
import { getPeople, createPerson } from '@/lib/db';

export async function GET() {
  try {
    const people = getPeople();
    return NextResponse.json(people);
  } catch (err) {
    console.error('[api/people] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!color || typeof color !== 'string') {
      return NextResponse.json({ error: 'Color is required' }, { status: 400 });
    }

    const id = createPerson(name.trim(), color);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('[api/people] POST error:', err);
    return NextResponse.json({ error: 'Failed to create person' }, { status: 500 });
  }
}
