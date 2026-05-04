import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_PATH, getPersonById, updatePerson } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const person = getPersonById(params.id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const ext = path.extname(file.name) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOADS_PATH, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;
    updatePerson(params.id, { photo_url: url });

    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error('[api/people/[id]/photo] POST error:', err);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
