import { NextResponse } from 'next/server';
import { BUILD_INFO } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(BUILD_INFO);
  } catch (err) {
    console.error('[api/version] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 });
  }
}
