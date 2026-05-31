import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { idempotencyKeys } from "@/lib/db/schema";
import type { ActionResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Schema for validating stored idempotency responses (guards against corrupted JSONB). */
const storedResponseSchema = z.union([
  z.object({ success: z.literal(true), data: z.unknown() }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

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
    const parsed = storedResponseSchema.safeParse(existing.response);
    if (parsed.success) {
      return parsed.data as ActionResponse<T>;
    }
    // Corrupted idempotency record — delete and fall through to handler
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
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
      response: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
    });

    await cleanupExpiredKeys();
  }

  return result;
}
