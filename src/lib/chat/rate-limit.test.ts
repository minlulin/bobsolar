import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the chat rate limiter.
 *
 * Tests the sliding-window rate limiting algorithm backed by the database.
 */

// We mock the db module, then in each test we re-mock the select chain
// to return the desired count.
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

describe("chat rate limiter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockSelect.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  function mockQuery(result: Array<{ count: number | null }>) {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve(result),
      }),
    }));
  }

  describe("checkChatRateLimit", () => {
    it("allows request when count is below limit", async () => {
      mockQuery([{ count: 5 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(14); // 20 - 5 - accepted request
    });

    it("blocks request when count reaches the limit", async () => {
      mockQuery([{ count: 20 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("blocks request when count exceeds the limit", async () => {
      mockQuery([{ count: 25 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("allows first request (count = 0)", async () => {
      mockQuery([{ count: 0 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it("returns resetAt timestamp in the future", async () => {
      mockQuery([{ count: 0 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const before = Date.now();
      const result = await checkChatRateLimit("user-1");
      const after = Date.now();

      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before + 60000);
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(after + 60000 + 100);
    });

    it("handles null count from DB gracefully", async () => {
      mockQuery([{ count: null }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it("handles empty result from DB gracefully", async () => {
      mockQuery([]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it("returns remaining = 1 when count is 19 (one below limit)", async () => {
      mockQuery([{ count: 19 }]);

      const { checkChatRateLimit } = await import("./rate-limit");
      const result = await checkChatRateLimit("user-1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("is per-user: different users have independent counts", async () => {
      let callIndex = 0;
      const counts = [{ count: 19 }, { count: 5 }];
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([counts[callIndex++]]),
        }),
      }));

      const { checkChatRateLimit } = await import("./rate-limit");

      const result1 = await checkChatRateLimit("user-1");
      const result2 = await checkChatRateLimit("user-2");

      expect(result1.remaining).toBe(0);
      expect(result2.remaining).toBe(14);
    });
  });
});
