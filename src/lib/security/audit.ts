import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type AuditAction, auditLogs, type NewAuditLog } from "@/lib/db/schema";

/**
 * Security audit trail.
 *
 * Records security-relevant events (login, logout, password change,
 * session revocation) for compliance and forensic analysis.
 *
 * The `audit_action` enum is limited to 4 values. Custom event types
 * (csrf_blocked, rate_limit_hit, quota_exceeded) are stored in the
 * `details` field with an `eventType` key.
 */

/** Event types tracked in the audit trail. */
export type SecurityEventType =
  | "login"
  | "logout"
  | "password_change"
  | "session_revoke"
  | "csrf_blocked"
  | "rate_limit_hit"
  | "quota_exceeded";

/** Map a SecurityEventType to a valid AuditAction for the DB enum. */
function toAuditAction(eventType: SecurityEventType): AuditAction {
  switch (eventType) {
    case "login":
      return "login";
    case "logout":
      return "logout";
    case "password_change":
      return "password_change";
    case "session_revoke":
      return "session_revoke";
    default:
      // Map security events that don't have a dedicated enum value
      // to "login" — the real type is captured in details.eventType.
      return "login";
  }
}

/**
 * Log a security event to the audit trail.
 *
 * Best-effort: never throws. Failures are logged but do not block
 * the main request flow.
 */
export async function logSecurityEvent(
  userId: string,
  eventType: SecurityEventType,
  details?: Record<string, unknown>,
  ipAddress?: string | null,
): Promise<void> {
  try {
    const entry: NewAuditLog = {
      userId,
      action: toAuditAction(eventType),
      details: { eventType, ...details },
      ipAddress: ipAddress ?? null,
    };
    await db.insert(auditLogs).values(entry);
  } catch (err) {
    console.error("[Security Audit] Failed to log event:", err);
  }
}

/**
 * Query recent audit events for a user.
 */
export async function getRecentAuditEvents(
  userId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    action: string;
    details: unknown;
    ipAddress: string | null;
    createdAt: Date;
  }>
> {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
