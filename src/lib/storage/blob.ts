import { del, put } from '@vercel/blob';
import { randomUUID } from 'crypto';

function requireToken(): string {
  const token = process.env['BLOB_READ_WRITE_TOKEN'];
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  return token;
}

/**
 * Uploads a file object to Vercel Blob storage.
 */
export async function uploadFileFromBufferOrBlob(
  data: Buffer | Blob | ReadableStream<ArrayBufferLike> | ArrayBuffer,
  filename: string,
  folder: string,
  contentType: string | undefined,
): Promise<string> {
  const token = requireToken();
  const safeName = filename.replace(/[^\w.\-]/g, '_');
  const pathname = `${folder.replace(/^\//, '')}/${randomUUID()}-${safeName}`;

  const options: Parameters<typeof put>[2] = {
    access: 'public',
    token,
    cacheControlMaxAge: 60 * 60 * 24 * 30,
    ...(contentType ? { contentType } : {}),
  };

  const result = await put(pathname, data, options);

  return result.url;
}

export async function deleteFile(url: string): Promise<void> {
  const token = requireToken();
  await del(url, { token });
}
