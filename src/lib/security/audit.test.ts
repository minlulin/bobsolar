import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the security audit trail.
 */

// The audit module calls: db.insert(auditLogs).values(entry)
// and: db.select().from(auditLogs).where(...).orderBy(...).limit(...)
const mockValues = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

interface AuditInsert {
  userId: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
}

function getAuditInsert(): AuditInsert {
  const value = mockValues.mock.calls[0]?.[0] as AuditInsert | undefined;
  if (!value) throw new Error("Expected an audit insert");
  return value;
}

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockValues,
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockWhere.mockReturnValue({
          orderBy: mockOrderBy.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  auditLogs: {
    userId: "user_id",
    action: "action",
    details: "details",
    ipAddress: "ip_address",
    createdAt: "created_at",
  },
}));

describe("security audit trail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockValues.mockReset();
    mockWhere.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  describe("logSecurityEvent", () => {
    it("logs a login event successfully", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "login", { method: "password" }, "127.0.0.1");

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.userId).toBe("user-1");
      expect(callArg.action).toBe("login");
      expect(callArg.details["eventType"]).toBe("login");
      expect(callArg.ipAddress).toBe("127.0.0.1");
    });

    it("logs a logout event", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "logout");

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.action).toBe("logout");
      expect(callArg.details["eventType"]).toBe("logout");
    });

    it("logs a password_change event", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "password_change");

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.action).toBe("password_change");
    });

    it("logs a session_revoke event", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "session_revoke");

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.action).toBe("session_revoke");
    });

    it("logs custom security events (csrf_blocked) with eventType in details", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "csrf_blocked", { path: "/api/chat" });

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      // Custom events map to "login" action enum, real type in details
      expect(callArg.details["eventType"]).toBe("csrf_blocked");
      expect(callArg.details["path"]).toBe("/api/chat");
    });

    it("logs rate_limit_hit event", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "rate_limit_hit", { endpoint: "/api/chat" });

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.details["eventType"]).toBe("rate_limit_hit");
    });

    it("logs quota_exceeded event", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "quota_exceeded", {
        reason: "daily_token_quota_exceeded",
      });

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.details["eventType"]).toBe("quota_exceeded");
    });

    it("never throws — catches DB errors gracefully", async () => {
      mockValues.mockRejectedValueOnce(new Error("DB connection lost"));

      const { logSecurityEvent } = await import("./audit");

      // Should not throw
      await expect(logSecurityEvent("user-1", "login")).resolves.toBeUndefined();
    });

    it("includes eventType in details", async () => {
      let capturedArg: unknown;
      mockValues.mockImplementationOnce((arg: unknown) => {
        capturedArg = arg;
        return Promise.resolve();
      });

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "login", { extra: "data" });

      expect(capturedArg).toBeDefined();
      const details = (capturedArg as { details: Record<string, unknown> }).details;
      expect(details["eventType"]).toBe("login");
      expect(details["extra"]).toBe("data");
    });

    it("handles null ipAddress", async () => {
      mockValues.mockResolvedValueOnce(undefined);

      const { logSecurityEvent } = await import("./audit");
      await logSecurityEvent("user-1", "login", undefined, null);

      expect(mockValues).toHaveBeenCalledTimes(1);
      const callArg = getAuditInsert();
      expect(callArg.ipAddress).toBeNull();
    });
  });

  describe("getRecentAuditEvents", () => {
    it("returns recent events for a user", async () => {
      const mockEvents = [
        { id: "1", action: "login", details: {}, ipAddress: "127.0.0.1", createdAt: new Date() },
        { id: "2", action: "logout", details: {}, ipAddress: "127.0.0.1", createdAt: new Date() },
      ];
      mockLimit.mockResolvedValueOnce(mockEvents);

      const { getRecentAuditEvents } = await import("./audit");
      const result = await getRecentAuditEvents("user-1", 10);

      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe("login");
    });

    it("returns empty array when no events exist", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecentAuditEvents } = await import("./audit");
      const result = await getRecentAuditEvents("user-1");

      expect(result).toEqual([]);
    });

    it("defaults to 50 events when no limit specified", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecentAuditEvents } = await import("./audit");
      await getRecentAuditEvents("user-1");

      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });
});
