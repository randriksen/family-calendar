import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_PATH } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.ics') && file.type !== 'text/calendar') {
      return NextResponse.json({ error: 'Only .ics files are allowed' }, { status: 400 });
    }

    const filename = `${uuidv4()}.ics`;
    const filePath = path.join(UPLOADS_PATH, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({ file_path: filename }, { status: 201 });
  } catch (err) {
    console.error('[api/upload] POST error:', err);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
