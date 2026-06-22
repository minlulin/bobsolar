import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Database integration tests for the chat system.
 *
 * Tests the session, conversation, message, and usage-log persistence layer.
 * We mock the Drizzle ORM to verify correct query construction and data flow.
 */

const dbOperations: Array<{
  operation: string;
  table: string;
  data?: unknown;
}> = [];

const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();

// Build a flexible mock that supports both:
//   db.select().from().where().limit()  (getConversation)
//   db.select().from().where().orderBy().limit()  (listConversations, getConversationMessages)
function buildSelectMock(table: string) {
  const whereResult: { limit: typeof mockLimit; orderBy: typeof mockOrderBy } = {
    limit: mockLimit,
    orderBy: mockOrderBy.mockReturnValue({
      limit: mockLimit,
    }) as unknown as typeof mockOrderBy,
  };

  return {
    from: vi.fn(() => ({
      where: mockWhere.mockImplementation(() => {
        dbOperations.push({ operation: "select", table });
        return whereResult;
      }),
    })),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn((table: string) => ({
      values: vi.fn((data: unknown) => {
        dbOperations.push({ operation: "insert", table, data });
        return { returning: mockReturning };
      }),
    })),
    select: vi.fn(() => buildSelectMock("dynamic")),
    update: vi.fn((table: string) => ({
      set: mockSet.mockImplementation((data: unknown) => {
        dbOperations.push({ operation: "update", table, data });
        return {
          where: mockWhere.mockReturnValue({
            returning: mockReturning,
          }),
        };
      }),
    })),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  chatConversations: {
    id: "id",
    userId: "user_id",
    title: "title",
    brand: "brand",
    lastErrorCode: "last_error_code",
    metadata: "metadata",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  chatMessages: {
    id: "id",
    conversationId: "conversation_id",
    userId: "user_id",
    role: "role",
    content: "content",
    parts: "parts",
    parentMessageId: "parent_message_id",
    metadata: "metadata",
    createdAt: "created_at",
  },
  chatSessions: {
    id: "id",
    userId: "user_id",
    conversationId: "conversation_id",
    status: "status",
    expiresAt: "expires_at",
    lastActivityAt: "last_activity_at",
    ipAddress: "ip_address",
    userAgent: "user_agent",
    createdAt: "created_at",
  },
  chatUsageLogs: {
    id: "id",
    userId: "user_id",
    sessionId: "session_id",
    conversationId: "conversation_id",
    messageId: "message_id",
    model: "model",
    promptTokens: "prompt_tokens",
    completionTokens: "completion_tokens",
    totalTokens: "total_tokens",
    costUsd: "cost_usd",
    latencyMs: "latency_ms",
    errorCode: "error_code",
    ipAddress: "ip_address",
    userAgent: "user_agent",
    createdAt: "created_at",
  },
}));

describe("chat database integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    dbOperations.length = 0;
    mockReturning.mockReset();
    mockWhere.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
    mockSet.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  describe("createConversation", () => {
    it("inserts a conversation with correct user ID and title", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "conv-new", userId: "user-1" }]);

      const { createConversation } = await import("./sessions");
      const result = await createConversation("user-1", {
        title: "Test conversation",
        brand: "Growatt",
        lastErrorCode: "F09",
      });

      expect(result.id).toBe("conv-new");
      const data = dbOperations[0]?.data as Record<string, unknown>;
      expect(data["userId"]).toBe("user-1");
      expect(data["title"]).toBe("Test conversation");
      expect(data["brand"]).toBe("Growatt");
      expect(data["lastErrorCode"]).toBe("F09");
    });
  });

  describe("getConversation", () => {
    it("queries by conversation ID and user ID", async () => {
      mockLimit.mockResolvedValueOnce([{ id: "conv-1", userId: "user-1", title: "Test" }]);

      const { getConversation } = await import("./sessions");
      const result = await getConversation("conv-1", "user-1");

      expect(result?.id).toBe("conv-1");
      expect(dbOperations).toHaveLength(1);
      expect(dbOperations[0]?.operation).toBe("select");
    });

    it("returns null when conversation not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getConversation } = await import("./sessions");
      const result = await getConversation("nonexistent", "user-1");

      expect(result).toBeNull();
    });
  });

  describe("saveMessage", () => {
    it("inserts a message and touches conversation updatedAt", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "msg-1" }]) // insert message
        .mockResolvedValueOnce([{ id: "conv-1" }]); // update conversation

      const { saveMessage } = await import("./sessions");
      const result = await saveMessage({
        conversationId: "conv-1",
        userId: "user-1",
        role: "user",
        content: "Hello",
        parts: null,
        parentMessageId: null,
        metadata: { brand: "Growatt" },
      });

      expect(result.id).toBe("msg-1");
      // Should have 2 operations: insert message + update conversation
      expect(dbOperations).toHaveLength(2);
      expect(dbOperations[0]?.operation).toBe("insert");
      expect(dbOperations[1]?.operation).toBe("update");
    });
  });

  describe("createSession", () => {
    it("creates a session with correct user and expiration", async () => {
      // evictExpiredSessions: select active sessions (limit)
      mockLimit.mockResolvedValueOnce([]);
      // countActiveSessions: select active sessions (limit)
      mockLimit.mockResolvedValueOnce([]);
      // insert session
      mockReturning.mockResolvedValueOnce([{ id: "sess-new" }]);

      const { createSession } = await import("./sessions");
      const result = await createSession("user-1", "conv-1");

      expect(result.id).toBe("sess-new");
    });
  });

  describe("updateSessionActivity", () => {
    it("updates lastActivityAt timestamp", async () => {
      mockWhere.mockResolvedValueOnce(undefined);

      const { updateSessionActivity } = await import("./sessions");
      await updateSessionActivity("sess-1");

      expect(dbOperations).toHaveLength(1);
      expect(dbOperations[0]?.operation).toBe("update");
      const updateData = dbOperations[0]?.data as Record<string, unknown>;
      expect(updateData["lastActivityAt"]).toBeInstanceOf(Date);
    });
  });

  describe("logUsage", () => {
    it("inserts usage log with all fields", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "usage-1" }]);

      const { logUsage } = await import("./sessions");
      await logUsage({
        userId: "user-1",
        sessionId: "sess-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        model: "gemini-2.5-flash (primary)",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        costUsd: "0.000450",
        latencyMs: 2500,
        errorCode: null,
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });

      expect(dbOperations).toHaveLength(1);
      expect(dbOperations[0]?.operation).toBe("insert");
      const usageData = dbOperations[0]?.data as Record<string, unknown>;
      expect(usageData["userId"]).toBe("user-1");
      expect(usageData["promptTokens"]).toBe(1000);
      expect(usageData["completionTokens"]).toBe(500);
      expect(usageData["totalTokens"]).toBe(1500);
      expect(usageData["costUsd"]).toBe("0.000450");
      expect(usageData["latencyMs"]).toBe(2500);
      expect(usageData["ipAddress"]).toBe("127.0.0.1");
    });

    it("handles null token counts gracefully", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "usage-2" }]);

      const { logUsage } = await import("./sessions");
      await logUsage({
        userId: "user-1",
        sessionId: "sess-1",
        conversationId: "conv-1",
        messageId: null,
        model: "gemini-2.5-flash (primary)",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        costUsd: null,
        latencyMs: 1000,
        errorCode: "stream_error",
        ipAddress: null,
        userAgent: null,
      });

      expect(dbOperations).toHaveLength(1);
      const nullData = dbOperations[0]?.data as Record<string, unknown>;
      expect(nullData["promptTokens"]).toBeNull();
      expect(nullData["errorCode"]).toBe("stream_error");
    });
  });

  describe("listConversations", () => {
    it("queries conversations by user ID with limit", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "conv-1", title: "Chat 1" },
        { id: "conv-2", title: "Chat 2" },
      ]);

      const { listConversations } = await import("./sessions");
      const result = await listConversations("user-1", 10);

      expect(result).toHaveLength(2);
      expect(dbOperations[0]?.operation).toBe("select");
    });
  });

  describe("getConversationMessages", () => {
    it("queries messages by conversation ID ordered by creation time", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "msg-1", content: "Hello", createdAt: new Date() },
        { id: "msg-2", content: "Hi there", createdAt: new Date() },
      ]);

      const { getConversationMessages } = await import("./sessions");
      const result = await getConversationMessages("conv-1");

      expect(result).toHaveLength(2);
      expect(dbOperations[0]?.operation).toBe("select");
    });
  });
});
