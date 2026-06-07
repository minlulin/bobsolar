import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1 AS ok`);
    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
