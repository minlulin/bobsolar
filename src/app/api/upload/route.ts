import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/validate";
import {
  UPLOAD_MAX_SIZE_BYTES,
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_MS,
} from "@/lib/domain/policies";
import { uploadFileFromBufferOrBlob } from "@/lib/storage/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_FOLDERS: Readonly<Record<string, string>> = {
  logos: "logos",
  uploads: "uploads",
};
const DEFAULT_UPLOAD_FOLDER = "uploads";
const rateLimitStore = new Map<string, { count: number; windowStartMs: number }>();

function resolveUploadFolder(entry: FormDataEntryValue | null): string | null {
  if (typeof entry !== "string") {
    return DEFAULT_UPLOAD_FOLDER;
  }
  return ALLOWED_FOLDERS[entry] ?? null;
}

function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || null;
}

function isRateLimited(rateKey: string): boolean {
  const nowMs = Date.now();
  const existing = rateLimitStore.get(rateKey);
  if (!existing || nowMs - existing.windowStartMs >= UPLOAD_RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(rateKey, { count: 1, windowStartMs: nowMs });
    return false;
  }

  if (existing.count >= UPLOAD_RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  rateLimitStore.set(rateKey, {
    count: existing.count + 1,
    windowStartMs: existing.windowStartMs,
  });
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateKey = currentUser.userId || getClientIp(request);
    if (!rateKey || isRateLimited(rateKey)) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please wait and retry." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const entry = formData.get("file");
    const folder = resolveUploadFolder(formData.get("folder"));
    if (!folder) {
      return NextResponse.json({ error: "Invalid upload folder." }, { status: 400 });
    }

    if (!(entry instanceof Blob)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const file = entry;
    const type = file.type;

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: "Only jpeg, png, and webp images are allowed.",
        },
        { status: 415 },
      );
    }

    if (typeof file.size === "number" && file.size > UPLOAD_MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File must be under 5MB." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const signatureType = detectImageType(buf);
    if (!signatureType || signatureType !== type) {
      return NextResponse.json({ error: "Invalid or spoofed image file." }, { status: 415 });
    }

    const url = await uploadFileFromBufferOrBlob(buf, file.name, folder, type);

    return NextResponse.json({ url }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("BLOB_READ_WRITE_TOKEN")
        ? "File storage not configured."
        : "Upload failed.";
    console.error("[upload]", e);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
