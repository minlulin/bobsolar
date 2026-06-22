import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for POST /api/chat — request lifecycle gates.
 *
 * Covers the early-exit paths that do NOT require the AI SDK:
 *   1. Authentication (401)
 *   2. IP throttle (429)
 *   3. Per-user rate limit (429)
 *   4. Token quota (429)
 *   5. JSON parse failure (400)
 *   6. Zod validation failure (422)
 *   7. Conversation not found (404)
 *   8. Session setup failure (500)
 *   9. Headers on successful response
 */

// ── Mocks ────────────────────────────────────────────────────────────────

const mockStreamText = vi.hoisted(() => vi.fn());
const mockEmbed = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  streamText: mockStreamText,
  embed: mockEmbed,
  tool: vi.fn((def) => def),
  stepCountIs: vi.fn((count: number) => ({ count })),
  convertToModelMessages: vi.fn(async (messages: unknown[]) => messages),
}));

vi.mock("@ai-sdk/google", () => {
  const textEmbeddingModel = vi.fn(() => ({ model: "gemini-embedding-001" }));
  const mockProvider = Object.assign((model: string) => ({ model, provider: "google" }), {
    textEmbeddingModel,
  });
  return {
    createGoogleGenerativeAI: vi.fn(() => mockProvider),
  };
});

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user-id", role: "admin" as const })),
  requireChatAccess: vi.fn(async () => ({ userId: "test-user-id", role: "admin" as const })),
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
  knowledgeChunks: {
    embedding: "embedding_col",
    content: "content_col",
  },
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
  createConversation: vi.fn(async () => ({ id: "conv-1", userId: "test-user-id" })),
  createSession: vi.fn(async () => ({ id: "sess-1" })),
  getConversation: vi.fn(async () => null),
  getOrCreateSession: vi.fn(async () => ({ id: "sess-1" })),
  logUsage: vi.fn(async () => {}),
  saveMessage: vi.fn(async () => ({ id: "msg-1" })),
  updateSessionActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/chat/validation", () => ({
  knowledgeSearchInputSchema: {},
  validateChatRequest: vi.fn((_body: unknown) => ({
    messages: [{ role: "user", content: "test" }],
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

// Key rotator: always return a valid key by default, tests can override
vi.mock("@/lib/chat/key-rotator", () => ({
  getNextKey: vi.fn(() => ({ key: "test-key", label: "primary" })),
  getMaxRetries: vi.fn(() => 1),
  isQuotaError: vi.fn((err: unknown) => String(err).includes("429")),
  reportKeyFailure: vi.fn(),
  reportKeySuccess: vi.fn(),
  getKeyCount: vi.fn(() => 1),
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(
  opts: {
    method?: string;
    contentType?: string;
    body?: string;
    origin?: string;
    xForwardedFor?: string;
  } = {},
): NextRequest {
  const {
    method = "POST",
    contentType = "application/json",
    body = JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    origin = "http://localhost",
    xForwardedFor = "127.0.0.1",
  } = opts;

  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (origin) headers["origin"] = origin;
  if (xForwardedFor) headers["x-forwarded-for"] = xForwardedFor;

  return new NextRequest("http://localhost/api/chat", {
    method,
    headers,
    body,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/chat — unit tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    process.env["GEMINI_API_KEY_PRIMARY"] = "test-key-1";
    vi.stubEnv("NODE_ENV", "development");
    mockStreamText.mockReset();
    mockEmbed.mockReset();
    const { getNextKey } = await import("@/lib/chat/key-rotator");
    (getNextKey as ReturnType<typeof vi.fn>).mockReset();
    (getNextKey as ReturnType<typeof vi.fn>).mockReturnValue({
      key: "test-key",
      label: "primary",
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

  // ── 1. Authentication ───────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when requireChatAccess throws (no session)", async () => {
      const { requireChatAccess } = await import("@/lib/auth/validate");
      (requireChatAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("REDIRECT:/login"),
      );

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Authentication required");
    });
  });

  // ── 2. IP Throttle ──────────────────────────────────────────────────

  describe("IP throttle", () => {
    it("returns 429 when IP throttle blocks the request", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 10_000,
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain("Too many requests from this IP");
      expect(response.headers.get("Retry-After")).toBe("10");
    });

    it("fails closed when IP throttle check throws", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB connection lost"),
      );

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(503);
      expect(response.status).not.toBe(429);
    });
  });

  // ── 3. Rate Limiting ────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when per-user rate limit is exceeded", async () => {
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
      const body = await response.json();
      expect(body.error).toContain("Rate limit exceeded");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBe(resetAt.toISOString());
      expect(response.headers.get("Retry-After")).toBeTruthy();
    });
  });

  // ── 4. Token Quota ──────────────────────────────────────────────────

  describe("token quota", () => {
    it("returns 429 when daily token quota is exceeded", async () => {
      const { checkUserQuota } = await import("@/lib/chat/quota");
      (checkUserQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        dailyTokensRemaining: 0,
        monthlyTokensRemaining: 4_000_000,
        dailyCostUsd: 1.23,
        reason: "daily_token_quota_exceeded",
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain("Daily token quota exceeded");
      expect(body.reason).toBe("daily_token_quota_exceeded");
      expect(response.headers.get("X-Quota-Daily-Remaining")).toBe("0");
      expect(response.headers.get("X-Quota-Monthly-Remaining")).toBe("4000000");
    });

    it("returns 429 when monthly token quota is exceeded", async () => {
      const { checkUserQuota } = await import("@/lib/chat/quota");
      (checkUserQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        dailyTokensRemaining: 100_000,
        monthlyTokensRemaining: 0,
        dailyCostUsd: 5.0,
        reason: "monthly_token_quota_exceeded",
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain("Monthly token quota exceeded");
      expect(body.reason).toBe("monthly_token_quota_exceeded");
    });

    it("fails closed when quota check throws", async () => {
      const { checkUserQuota } = await import("@/lib/chat/quota");
      (checkUserQuota as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB timeout"));

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(503);
      expect(response.status).not.toBe(429);
    });
  });

  // ── 5. Request Validation ───────────────────────────────────────────

  describe("request validation", () => {
    it("returns 400 when body is not valid JSON", async () => {
      const { POST } = await import("./route");
      const response = await POST(makeRequest({ body: "not-json" }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid JSON body");
    });

    it("returns 422 when Zod validation fails", async () => {
      const { validateChatRequest } = await import("@/lib/chat/validation");
      const { ZodError } = await import("zod");

      (validateChatRequest as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        const issue = {
          code: "custom" as const,
          path: ["messages"],
          message: "At least one message is required",
        };
        throw new ZodError([issue]);
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toBeDefined();
    });

    it("returns 400 for empty body", async () => {
      const { POST } = await import("./route");
      const response = await POST(makeRequest({ body: "" }));

      expect(response.status).toBe(400);
    });
  });

  // ── 6. Conversation Management ──────────────────────────────────────

  describe("conversation management", () => {
    it("creates the client-selected conversation when it does not exist", async () => {
      const { validateChatRequest } = await import("@/lib/chat/validation");
      (validateChatRequest as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        messages: [{ role: "user", content: "test" }],
        brand: undefined,
        errorCode: undefined,
        conversationId: "nonexistent-conv-id",
      });

      const { getConversation } = await import("@/lib/chat/sessions");
      (getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(() => new Response("ok")),
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      const { createConversation } = await import("@/lib/chat/sessions");
      expect(createConversation).toHaveBeenCalledWith(
        "test-user-id",
        expect.objectContaining({ id: "nonexistent-conv-id" }),
      );
    });

    it("returns 500 when session setup fails", async () => {
      const { getOrCreateSession } = await import("@/lib/chat/sessions");
      (getOrCreateSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB insert failed"),
      );

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to initialize chat session");
    });
  });

  // ── 7. Key Rotation Exhaustion ──────────────────────────────────────

  describe("key rotation exhaustion", () => {
    it("returns 503 when all keys are on cooldown", async () => {
      const { getNextKey } = await import("@/lib/chat/key-rotator");
      (getNextKey as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toContain("All API keys are temporarily rate-limited");
      expect(response.headers.get("Retry-After")).toBeTruthy();
    });
  });

  // ── 8. Successful Response Headers ──────────────────────────────────

  describe("successful response headers", () => {
    it("includes session and conversation IDs in response headers", async () => {
      // Ensure key rotator returns a valid key (previous tests may have overridden)
      const { getNextKey } = await import("@/lib/chat/key-rotator");
      (getNextKey as ReturnType<typeof vi.fn>).mockReturnValue({
        key: "test-key",
        label: "primary",
      });

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("stream-ok");
            // The route passes headers in opts.headers — verify they're provided
            if (opts?.headers) {
              for (const [k, v] of Object.entries(opts.headers)) {
                resp.headers.set(k, v);
              }
            }
            return resp;
          },
        ),
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Chat-Session-Id")).toBe("sess-1");
      expect(response.headers.get("X-Chat-Conversation-Id")).toBe("conv-1");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("19");
    });
  });

  // ── 9. Client IP Extraction ─────────────────────────────────────────

  describe("client IP extraction", () => {
    it("extracts IP from X-Forwarded-For header", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockClear();
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: true,
        remaining: 3,
        retryAfterMs: 0,
      });

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn((_opts: unknown) => new Response("ok")),
      });

      const { POST } = await import("./route");
      await POST(makeRequest({ xForwardedFor: "203.0.113.50" }));

      expect(checkIpThrottle).toHaveBeenCalledWith("203.0.113.50");
    });

    it("handles multiple IPs in X-Forwarded-For (takes first)", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockClear();
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: true,
        remaining: 3,
        retryAfterMs: 0,
      });

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn((_opts: unknown) => new Response("ok")),
      });

      const { POST } = await import("./route");
      await POST(makeRequest({ xForwardedFor: "203.0.113.50, 70.41.3.18" }));

      expect(checkIpThrottle).toHaveBeenCalledWith("203.0.113.50");
    });
  });

  // ── 10. Non-quota Error Handling ────────────────────────────────────

  describe("non-quota error handling", () => {
    it("returns 500 on non-quota streamText error without retrying", async () => {
      const { isQuotaError } = await import("@/lib/chat/key-rotator");
      (isQuotaError as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Ensure key rotator returns a valid key
      const { getNextKey } = await import("@/lib/chat/key-rotator");
      (getNextKey as ReturnType<typeof vi.fn>).mockReturnValue({
        key: "test-key",
        label: "primary",
      });

      mockStreamText.mockRejectedValueOnce(new Error("connection refused"));

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to process chat request");
      expect(mockStreamText).toHaveBeenCalledTimes(1);
    });
  });
});
