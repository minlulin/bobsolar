import { NextResponse } from "next/server";
import { createBackupInternal } from "@/actions/backup-actions";

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env["CRON_SECRET"];
  if (!cronSecret) {
    console.error("[cron/backup] CRON_SECRET is not configured. Skipping backup.");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createBackupInternal();

    return NextResponse.json({
      status: "ok",
      backup: {
        filename: result.filename,
        totalRows: result.totalRows,
        size: result.size,
        url: result.url,
      },
    });
  } catch {
    return NextResponse.json(
      { status: "error", error: "Backup generation failed" },
      { status: 500 },
    );
  }
}
