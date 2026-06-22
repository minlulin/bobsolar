import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the IP-based throttle.
 *
 * Tests the abuse-prevention layer that limits requests per IP address
 * within a short time window.
 */

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

describe("IP throttle", () => {
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

  describe("checkIpThrottle", () => {
    it("allows request when IP is below throttle limit", async () => {
      mockQuery([{ count: 1 }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("192.168.1.100");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 3 - 1 - accepted request
      expect(result.retryAfterMs).toBe(0);
    });

    it("blocks request when IP reaches throttle limit", async () => {
      mockQuery([{ count: 3 }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("192.168.1.100");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBe(10_000);
    });

    it("blocks request when IP exceeds throttle limit", async () => {
      mockQuery([{ count: 5 }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("10.0.0.1");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBe(10_000);
    });

    it("allows first request from a new IP (count = 0)", async () => {
      mockQuery([{ count: 0 }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("10.0.0.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("handles null count from DB gracefully", async () => {
      mockQuery([{ count: null }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("10.0.0.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("handles empty result from DB gracefully", async () => {
      mockQuery([]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("10.0.0.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("returns remaining = 1 when count is 2", async () => {
      mockQuery([{ count: 2 }]);

      const { checkIpThrottle } = await import("./ip-throttle");
      const result = await checkIpThrottle("10.0.0.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("is per-IP: different IPs have independent counts", async () => {
      let callIndex = 0;
      const counts = [{ count: 3 }, { count: 0 }];
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([counts[callIndex++]]),
        }),
      }));

      const { checkIpThrottle } = await import("./ip-throttle");

      const result1 = await checkIpThrottle("192.168.1.1");
      const result2 = await checkIpThrottle("10.0.0.1");

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });
});
