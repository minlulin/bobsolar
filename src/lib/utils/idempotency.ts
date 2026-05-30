import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { idempotencyKeys } from "@/lib/db/schema";
import type { ActionResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function hashPayload(action: string, userId: string, payload: unknown): string {
  const raw = JSON.stringify({ action, userId, payload });
  return createHash("sha256").update(raw).digest("hex");
}

async function cleanupExpiredKeys(): Promise<void> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  await db.delete(idempotencyKeys).where(sql`${idempotencyKeys.createdAt} < ${cutoff}`);
}

export async function withIdempotency<T>(
  action: string,
  userId: string,
  payload: unknown,
  handler: () => Promise<ActionResponse<T>>,
): Promise<ActionResponse<T>> {
  const key = hashPayload(action, userId, payload);

  const existing = await db.query.idempotencyKeys.findFirst({
    where: eq(idempotencyKeys.key, key),
  });

  if (existing) {
    return existing.response as ActionResponse<T>;
  }

  let result: ActionResponse<T>;
  try {
    result = await handler();
  } catch (error) {
    return handleActionError(error, `withIdempotency.${action}`, "Operation failed");
  }

  if (result.success) {
    await db.insert(idempotencyKeys).values({
      key,
      response: result as unknown as Record<string, unknown>,
    });

    await cleanupExpiredKeys();
  }

  return result;
}
