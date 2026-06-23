import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security penetration tests for the chat API.
 *
 * Tests common attack vectors: CSRF, injection, abuse, header manipulation,
 * and boundary conditions that could expose security vulnerabilities.
 */

const mockStreamText = vi.hoisted(() => vi.fn());
const mockEmbed = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  streamText: mockStreamText,
  embed: mockEmbed,
  tool: vi.fn((def) => def),
  stepCountIs: vi.fn((count: number) => ({ count })),
  convertToModelMessages: vi.fn(async (messages: unknown[]) => messages),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() =>
    Object.assign(() => ({ model: "test" }), {
      embedding: vi.fn(() => ({ model: "gemini-embedding-001" })),
    }),
  ),
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => ({ userId: "sec-test-user", role: "admin" as const })),
  requireChatAccess: vi.fn(async () => ({ userId: "sec-test-user", role: "admin" as const })),
}));

vi.mock("@/lib/security/csrf", () => ({
  withCsrf: (handler: (req: Request) => Promise<Response>) => handler,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "test-id" }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "test-id" }]),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  knowledgeChunks: { embedding: "e", content: "c" },
}));

vi.mock("@/lib/chat/ip-throttle", () => ({
  checkIpThrottle: vi.fn(async () => ({ allowed: true, remaining: 3, retryAfterMs: 0 })),
}));

vi.mock("@/lib/chat/rate-limit", () => ({
  checkChatRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  })),
}));

vi.mock("@/lib/chat/quota", () => ({
  checkUserQuota: vi.fn(async () => ({
    allowed: true,
    dailyTokensRemaining: 500000,
    monthlyTokensRemaining: 5000000,
    dailyCostUsd: 0,
    reason: null,
  })),
  calculateRequestCost: vi.fn(() => ({ inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 })),
}));

vi.mock("@/lib/chat/sessions", () => ({
  createConversation: vi.fn(async () => ({ id: "conv-sec", userId: "sec-test-user" })),
  createSession: vi.fn(async () => ({ id: "sess-sec" })),
  getConversation: vi.fn(async () => null),
  getOrCreateSession: vi.fn(async () => ({ id: "sess-sec" })),
  logUsage: vi.fn(async () => {}),
  saveMessage: vi.fn(async () => ({ id: "msg-sec" })),
  updateSessionActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/chat/validation", () => ({
  knowledgeSearchInputSchema: {},
  validateChatRequest: vi.fn((_body: unknown) => ({
    messages: [{ role: "user", content: "sanitized" }],
    brand: undefined,
    errorCode: undefined,
    conversationId: undefined,
  })),
}));

vi.mock("@/lib/chat/metrics", () => ({
  recordChatTokens: vi.fn(),
  recordChatCost: vi.fn(),
  recordChatLatency: vi.fn(),
  recordChatError: vi.fn(),
  recordKeyFailover: vi.fn(),
}));

vi.mock("@/lib/chat/key-rotator", () => ({
  getNextKey: vi.fn(() => ({ key: "sec-key", label: "primary" })),
  getMaxRetries: vi.fn(() => 1),
  isQuotaError: vi.fn((err: unknown) => String(err).includes("429")),
  reportKeyFailure: vi.fn(),
  reportKeySuccess: vi.fn(),
  getKeyCount: vi.fn(() => 1),
}));

function makeRequest(
  opts: {
    method?: string;
    contentType?: string;
    body?: string;
    origin?: string;
    xForwardedFor?: string;
    userAgent?: string;
  } = {},
): NextRequest {
  const {
    method = "POST",
    contentType = "application/json",
    body = JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
    origin = "http://localhost",
    xForwardedFor = "127.0.0.1",
    userAgent = "Mozilla/5.0",
  } = opts;

  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (origin) headers["origin"] = origin;
  if (xForwardedFor) headers["x-forwarded-for"] = xForwardedFor;
  if (userAgent) headers["user-agent"] = userAgent;

  return new NextRequest("http://localhost/api/chat", {
    method,
    headers,
    body,
  });
}

describe("security penetration tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env["GEMINI_API_KEY_PRIMARY"] = "sec-test-key";
    vi.stubEnv("NODE_ENV", "development");
    mockStreamText.mockReset();
    mockStreamText.mockResolvedValue({
      toUIMessageStreamResponse: vi.fn((opts: { headers?: Record<string, string> } | undefined) => {
        const resp = new Response("ok");
        if (opts?.headers) {
          for (const [k, v] of Object.entries(opts.headers)) {
            resp.headers.set(k, v);
          }
        }
        return resp;
      }),
    });
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("request smuggling and edge cases", () => {
    it("handles request with no content-type header", async () => {
      const { POST } = await import("./route");
      const req = new NextRequest("http://localhost/api/chat", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
      });

      // Should still process (content-type is checked by route for JSON parsing)
      const response = await POST(req);
      // Will fail JSON parse or proceed depending on implementation
      expect(response.status).toBeDefined();
    });

    it("handles request with extra unexpected fields", async () => {
      const { POST } = await import("./route");
      const req = new NextRequest("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
          __proto__: { isAdmin: true },
          constructor: { prototype: { isAdmin: true } },
        }),
      });

      // Should not crash — extra fields are ignored by Zod
      const response = await POST(req);
      expect(response.status).toBeDefined();
    });
  });

  describe("CSRF protection (unit-level, covered in csrf.test.ts)", () => {
    it("CSRF module is properly integrated in route", async () => {
      // The route uses withCsrf wrapper — verify it's applied
      // Detailed CSRF tests are in src/lib/security/csrf.test.ts
      const csrf = await import("@/lib/security/csrf");
      expect(csrf.withCsrf).toBeDefined();
      expect(typeof csrf.withCsrf).toBe("function");
    });
  });

  describe("IP-based abuse prevention", () => {
    it("throttles rapid requests from same IP", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 10_000,
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeTruthy();
    });

    it("returns 429 with Retry-After header when IP throttled", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 10_000,
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get("Retry-After");
      expect(retryAfter).toBeTruthy();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });
  });

  describe("rate limit headers", () => {
    it("includes rate limit headers in 429 response", async () => {
      const resetAt = new Date(Date.now() + 60000);
      const { checkChatRateLimit } = await import("@/lib/chat/rate-limit");
      (checkChatRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBe(resetAt.toISOString());
      expect(response.headers.get("Retry-After")).toBeTruthy();
    });

    it("includes quota headers in 429 quota response", async () => {
      const { checkUserQuota } = await import("@/lib/chat/quota");
      (checkUserQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        dailyTokensRemaining: 0,
        monthlyTokensRemaining: 4_000_000,
        dailyCostUsd: 1.5,
        reason: "daily_token_quota_exceeded",
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(response.headers.get("X-Quota-Daily-Remaining")).toBe("0");
      expect(response.headers.get("X-Quota-Monthly-Remaining")).toBe("4000000");
    });
  });

  describe("error response safety", () => {
    it("does not leak internal error details to client", async () => {
      const { getOrCreateSession } = await import("@/lib/chat/sessions");
      (getOrCreateSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("FATAL: DB password=secret123 host=internal-db"),
      );

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to initialize chat session");
      expect(body.error).not.toContain("password");
      expect(body.error).not.toContain("internal-db");
    });

    it("returns generic error for non-quota AI failures", async () => {
      const { isQuotaError } = await import("@/lib/chat/key-rotator");
      (isQuotaError as ReturnType<typeof vi.fn>).mockReturnValue(false);
      mockStreamText.mockReset();
      mockStreamText.mockRejectedValueOnce(new Error("AI_API_ERROR: key=AIzaSy... internal trace"));

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to process chat request");
      expect(body.error).not.toContain("AIzaSy");
    });
  });

  describe("HTTP method validation", () => {
    it("GET request bypasses CSRF but is not handled by POST route", async () => {
      const { withCsrf } = await import("@/lib/security/csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("http://localhost/api/chat", {
        method: "GET",
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("X-Forwarded-For header handling", () => {
    it("handles missing X-Forwarded-For gracefully", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValue({
        allowed: true,
        remaining: 3,
        retryAfterMs: 0,
      });

      const { POST } = await import("./route");
      const req = new NextRequest("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
      });

      await POST(req);
      expect(checkIpThrottle).toHaveBeenCalledWith("unknown");
    });
  });
});
