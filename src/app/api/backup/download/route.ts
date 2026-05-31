import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const BACKUP_FOLDER = "backups";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { role: true },
    });

    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const blobUrl = searchParams.get("url");

    if (!blobUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    if (!blobUrl.includes(`${BACKUP_FOLDER}/`) || !blobUrl.endsWith(".json")) {
      return NextResponse.json({ error: "Invalid backup URL" }, { status: 400 });
    }

    const token = process.env["BLOB_READ_WRITE_TOKEN"];
    if (!token) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const result = await get(blobUrl, { access: "private", token });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const filename = blobUrl.split("/").pop() ?? "backup.json";

    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 },
    );
  }
}
