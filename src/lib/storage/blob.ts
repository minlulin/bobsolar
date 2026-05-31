import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

function getToken(): string | undefined {
  if (process.env["BLOB_READ_WRITE_TOKEN"]) {
    return process.env["BLOB_READ_WRITE_TOKEN"];
  }
  for (const key of Object.keys(process.env)) {
    if (key.endsWith("_READ_WRITE_TOKEN") && process.env[key]) {
      return process.env[key];
    }
  }
  return undefined;
}

function requireToken(): string {
  const token = getToken();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  return token;
}

async function toBuffer(
  data: Buffer | Blob | ReadableStream<ArrayBufferLike> | ArrayBuffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data instanceof Blob) return Buffer.from(await data.arrayBuffer());
  throw new Error("Unsupported upload data type for local fallback");
}

async function writeLocalFallback(
  data: Buffer | Blob | ReadableStream<ArrayBufferLike> | ArrayBuffer,
  filename: string,
  folder: string,
): Promise<string> {
  const safeName = filename.replace(/[^\w.-]/g, "_");
  const cleanFolder = folder.replace(/^\/+/, "");
  const targetDir = path.join(process.cwd(), ".uploads", cleanFolder);
  await mkdir(targetDir, { recursive: true });
  const outputName = `${randomUUID()}-${safeName}`;
  const outputPath = path.join(targetDir, outputName);
  const buf = await toBuffer(data);
  await writeFile(outputPath, buf);
  return `/api/local-file?path=${encodeURIComponent(path.join(cleanFolder, outputName))}`;
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
  const safeName = filename.replace(/[^\w.-]/g, "_");
  const cleanFolder = folder.replace(/^\//, "");
  const pathname = `${cleanFolder}/${randomUUID()}-${safeName}`;
  const token = getToken();

  if (!token && process.env["NODE_ENV"] !== "production") {
    return writeLocalFallback(data, filename, cleanFolder);
  }

  const options: Parameters<typeof put>[2] = {
    access: "public",
    token: requireToken(),
    cacheControlMaxAge: 60 * 60 * 24 * 30,
    ...(contentType ? { contentType } : {}),
  };

  try {
    const result = await put(pathname, data, options);
    return result.url;
  } catch (error) {
    if (process.env["NODE_ENV"] !== "production") {
      return writeLocalFallback(data, filename, cleanFolder);
    }
    throw error;
  }
}

export async function deleteFile(url: string): Promise<void> {
  const token = requireToken();
  await del(url, { token });
}
