import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const BACKUP_FOLDER = "backups";
// Strict pattern: backups/<uuid>.json — no path traversal, no subdirectories
const BACKUP_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate the session against the DB: check role, session_version stamp
    // (revocation), and archive status. Single indexed read.
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { role: true, sessionVersion: true, archivedAt: true },
    });

    if (!user || user.archivedAt !== null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.sessionVersion !== session.sv) {
      return NextResponse.json({ error: "Session revoked" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const blobUrl = searchParams.get("url");

    if (!blobUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // SECURITY: Parse the URL and validate only the pathname. Never trust the
    // host/origin from attacker input — reconstruct the blob URL from the known
    // store origin to prevent SSRF via crafted URLs.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(blobUrl);
    } catch {
      return NextResponse.json({ error: "Invalid backup URL" }, { status: 400 });
    }

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const filename = pathParts[1];
    if (
      pathParts.length !== 2 ||
      pathParts[0] !== BACKUP_FOLDER ||
      !filename ||
      !BACKUP_FILENAME_PATTERN.test(filename)
    ) {
      return NextResponse.json({ error: "Invalid backup URL" }, { status: 400 });
    }

    // Reconstruct the blob URL from the known store origin + validated pathname.
    // This prevents an attacker from supplying a URL that points to a different host.
    const storeOrigin = process.env["BLOB_STORE_ORIGIN"];
    if (!storeOrigin) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }
    const safeBlobUrl = `${storeOrigin.replace(/\/$/, "")}/${BACKUP_FOLDER}/${filename}`;

    const token = process.env["BLOB_READ_WRITE_TOKEN"];
    if (!token) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const result = await get(safeBlobUrl, { access: "private", token });

    if (result?.statusCode !== 200) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
