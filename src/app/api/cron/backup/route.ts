import { NextResponse } from "next/server";
import { createBackupInternal } from "@/actions/backup-actions";

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
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
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
