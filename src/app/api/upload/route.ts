import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { authRateLimits } from "@/lib/db/schema";
import {
  UPLOAD_MAX_SIZE_BYTES,
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_MS,
} from "@/lib/domain/policies";
import { isAllowedMimeType } from "@/lib/domain/upload";
import { uploadFileFromBufferOrBlob } from "@/lib/storage/blob";

const ALLOWED_FOLDERS: Readonly<Record<string, string>> = {
  logos: "logos",
  uploads: "uploads",
};
const DEFAULT_UPLOAD_FOLDER = "uploads";

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

function normalizeImageMimeType(type: string | null | undefined): string {
  const raw = (type ?? "").trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  return raw;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || null;
}

function makeUploadRateLimitKey(rateKey: string): string {
  return `upload:${rateKey}`;
}

async function isRateLimited(rateKey: string): Promise<boolean> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + UPLOAD_RATE_LIMIT_WINDOW_MS);
  const key = makeUploadRateLimitKey(rateKey);

  return db.transaction(async (tx) => {
    const existing = await tx.query.authRateLimits.findFirst({
      where: eq(authRateLimits.key, key),
    });

    if (!existing?.lockedUntil || existing.lockedUntil <= now) {
      if (existing) {
        await tx
          .update(authRateLimits)
          .set({
            attempts: 1,
            lockedUntil: lockUntil,
            lastAttemptAt: now,
            updatedAt: now,
          })
          .where(eq(authRateLimits.key, key));
      } else {
        await tx.insert(authRateLimits).values({
          key,
          attempts: 1,
          lockedUntil: lockUntil,
          lastAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      return false;
    }

    if (existing.attempts >= UPLOAD_RATE_LIMIT_MAX_REQUESTS) {
      await tx
        .update(authRateLimits)
        .set({
          lastAttemptAt: now,
          updatedAt: now,
        })
        .where(eq(authRateLimits.key, key));
      return true;
    }

    await tx
      .update(authRateLimits)
      .set({
        attempts: existing.attempts + 1,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(eq(authRateLimits.key, key));
    return false;
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // CSRF protection: validate origin header matches host for all POST requests
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const referer = request.headers.get("referer");

    if (!origin && !referer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (referer) {
      // Fallback: validate referer when origin is absent (some proxies strip it)
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) {
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
    if (!rateKey || (await isRateLimited(rateKey))) {
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

    if (!entry || typeof entry === "string") {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const file = entry;
    const type = normalizeImageMimeType(file.type);

    if (type && !isAllowedMimeType(type)) {
      return NextResponse.json(
        {
          error: "Only jpeg, png, and webp images are allowed.",
        },
        { status: 415 },
      );
    }

    if (typeof file.size === "number" && file.size > UPLOAD_MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds limit." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const signatureType = detectImageType(buf);
    if (!signatureType) {
      return NextResponse.json({ error: "Invalid or spoofed image file." }, { status: 415 });
    }

    if (type && signatureType !== type) {
      return NextResponse.json({ error: "Invalid or spoofed image file." }, { status: 415 });
    }

    const url = await uploadFileFromBufferOrBlob(buf, file.name, folder, signatureType);

    return NextResponse.json({ url }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[upload]", e);
    // Never leak internal error details to the client
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
