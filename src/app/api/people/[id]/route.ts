import { NextRequest, NextResponse } from 'next/server';
import { getPersonById, updatePerson, deletePerson, reorderPeople, getPeople } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const person = getPersonById(params.id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    return NextResponse.json(person);
  } catch (err) {
    console.error('[api/people/[id]] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const person = getPersonById(params.id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: { name?: string; color?: string; display_order?: number; photo_url?: string | null } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if (body.color !== undefined) {
      updates.color = body.color;
    }
    if (body.display_order !== undefined) {
      updates.display_order = parseInt(body.display_order, 10);
    }
    if ('photo_url' in body) {
      updates.photo_url = body.photo_url ?? null;
    }

    // Handle reorder array
    if (body.orderedIds && Array.isArray(body.orderedIds)) {
      reorderPeople(body.orderedIds);
      return NextResponse.json({ success: true });
    }

    updatePerson(params.id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/people/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const person = getPersonById(params.id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    deletePerson(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/people/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 });
  }
}
