import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { uploadFileFromBufferOrBlob } from '@/lib/storage/blob';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const sessionToken = request.cookies.get('session_id')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const entry = formData.get('file');
    const folderRaw = String(formData.get('folder') || 'uploads');
    const folder =
      folderRaw.replace(/[^a-zA-Z0-9_/-]/g, '').replace(/^\/+|\/+$/g, '') ||
      'uploads';

    if (!(entry instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing file field' },
        { status: 400 },
      );
    }

    const file = entry as File;
    const type = file.type;

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: 'Only jpeg, png, and webp images are allowed.',
        },
        { status: 415 },
      );
    }

    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File must be under 5MB.' },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    const url = await uploadFileFromBufferOrBlob(buf, file.name, folder, type);

    return NextResponse.json({ url }, { status: 200 });
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes('BLOB_READ_WRITE_TOKEN')
        ? 'File storage not configured.'
        : 'Upload failed.';
    console.error('[upload]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
