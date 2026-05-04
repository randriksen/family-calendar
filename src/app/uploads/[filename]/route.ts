import { NextRequest, NextResponse } from 'next/server';
import { UPLOADS_PATH } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const filepath = path.join(UPLOADS_PATH, params.filename);
  if (!fs.existsSync(filepath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data = fs.readFileSync(filepath);
  const ext = path.extname(params.filename).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return new NextResponse(data, { headers: { 'Content-Type': contentType } });
}
