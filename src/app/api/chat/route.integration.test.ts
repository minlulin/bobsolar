import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the chat API — full request lifecycle.
 *
 * These tests verify the complete flow through multiple gates:
 * auth → IP throttle → rate limit → quota → validation → session → AI → response.
 *
 * We mock external dependencies (AI SDK, DB) but test the full route handler
 * logic end-to-end within the API layer.
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
  requireAuth: vi.fn(async () => ({ userId: "integration-user", role: "admin" as const })),
  requireChatAccess: vi.fn(async () => ({ userId: "integration-user", role: "admin" as const })),
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
  createConversation: vi.fn(async () => ({ id: "conv-integration", userId: "integration-user" })),
  createSession: vi.fn(async () => ({ id: "sess-integration" })),
  getConversation: vi.fn(async () => null),
  getOrCreateSession: vi.fn(async () => ({ id: "sess-integration" })),
  logUsage: vi.fn(async () => {}),
  saveMessage: vi.fn(async () => ({ id: "msg-integration" })),
  updateSessionActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/chat/validation", () => ({
  knowledgeSearchInputSchema: {},
  validateChatRequest: vi.fn((_body: unknown) => ({
    messages: [{ role: "user", content: "integration test" }],
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
  getNextKey: vi.fn(() => ({ key: "integration-key", label: "primary" })),
  getMaxRetries: vi.fn(() => 1),
  isQuotaError: vi.fn((err: unknown) => String(err).includes("429")),
  reportKeyFailure: vi.fn(),
  reportKeySuccess: vi.fn(),
  getKeyCount: vi.fn(() => 1),
}));

function makeRequest(body: object = { messages: [{ role: "user", content: "test" }] }) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("chat API integration tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env["GEMINI_API_KEY_PRIMARY"] = "integration-test-key";
    vi.stubEnv("NODE_ENV", "development");
    mockStreamText.mockReset();
    mockEmbed.mockReset();
    const { getNextKey } = await import("@/lib/chat/key-rotator");
    (getNextKey as ReturnType<typeof vi.fn>).mockReset();
    (getNextKey as ReturnType<typeof vi.fn>).mockReturnValue({
      key: "integration-key",
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

  describe("full successful flow", () => {
    it("processes a valid chat request end-to-end", async () => {
      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("stream-ok");
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
      expect(response.headers.get("X-Chat-Session-Id")).toBe("sess-integration");
      expect(response.headers.get("X-Chat-Conversation-Id")).toBe("conv-integration");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("19");
    });

    it("uses AI SDK v6 tool schemas and enables a grounded follow-up step", async () => {
      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(() => new Response("ok")),
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      const config = mockStreamText.mock.calls[0]?.[0] as
        | {
            stopWhen?: { count: number };
            tools?: {
              searchKnowledgeBase?: {
                inputSchema?: unknown;
                parameters?: unknown;
              };
            };
          }
        | undefined;
      expect(config?.stopWhen).toEqual({ count: 3 });
      expect(config?.tools?.searchKnowledgeBase?.inputSchema).toBeDefined();
      expect(config?.tools?.searchKnowledgeBase?.parameters).toBeUndefined();
    });

    it("persists the completed assistant response", async () => {
      let finishPromise: Promise<void> | undefined;
      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: {
            onFinish?: (event: {
              responseMessage: {
                id: string;
                role: "assistant";
                parts: Array<{ type: "text"; text: string }>;
              };
            }) => Promise<void> | void;
          }) => {
            finishPromise = Promise.resolve(
              opts.onFinish?.({
                responseMessage: {
                  id: "assistant-1",
                  role: "assistant",
                  parts: [{ type: "text", text: "Grounded answer" }],
                },
              }),
            );
            return new Response("ok");
          },
        ),
      });

      const { saveMessage } = await import("@/lib/chat/sessions");
      const { POST } = await import("./route");
      const response = await POST(makeRequest());
      await finishPromise;

      expect(response.status).toBe(200);
      expect(saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "assistant",
          content: "Grounded answer",
          conversationId: "conv-integration",
        }),
      );
    });

    it("creates a new conversation when no conversationId is provided", async () => {
      const { createConversation } = await import("@/lib/chat/sessions");
      const { validateChatRequest } = await import("@/lib/chat/validation");

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("ok");
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
      const response = await POST(
        makeRequest({ messages: [{ role: "user", content: "Hello, I need help" }] }),
      );

      expect(response.status).toBe(200);
      expect(validateChatRequest).toHaveBeenCalled();
      expect(createConversation).toHaveBeenCalled();
    });

    it("reuses existing conversation when conversationId is provided", async () => {
      const { validateChatRequest } = await import("@/lib/chat/validation");
      const { getConversation } = await import("@/lib/chat/sessions");

      (validateChatRequest as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        messages: [{ role: "user", content: "Follow-up question" }],
        brand: undefined,
        errorCode: undefined,
        conversationId: "existing-conv-123",
      });

      (getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "existing-conv-123",
        userId: "integration-user",
        title: "Previous chat",
      });

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("ok");
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
      const response = await POST(
        makeRequest({
          messages: [{ role: "user", content: "Follow-up" }],
          conversationId: "existing-conv-123",
        }),
      );

      expect(response.status).toBe(200);
      expect(getConversation).toHaveBeenCalledWith("existing-conv-123", "integration-user");
    });
  });

  describe("gate ordering", () => {
    it("checks auth before IP throttle", async () => {
      const { requireChatAccess } = await import("@/lib/auth/validate");
      (requireChatAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("REDIRECT:/login"),
      );

      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(401);
      expect(checkIpThrottle).not.toHaveBeenCalled();
    });

    it("checks IP throttle before rate limit", async () => {
      const { checkIpThrottle } = await import("@/lib/chat/ip-throttle");
      (checkIpThrottle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterMs: 10_000,
      });

      const { checkChatRateLimit } = await import("@/lib/chat/rate-limit");

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("10");
      expect(checkChatRateLimit).not.toHaveBeenCalled();
    });

    it("checks rate limit before quota", async () => {
      const { checkChatRateLimit } = await import("@/lib/chat/rate-limit");
      (checkChatRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
      });

      const { checkUserQuota } = await import("@/lib/chat/quota");

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(checkUserQuota).not.toHaveBeenCalled();
    });

    it("checks quota before validation", async () => {
      const { checkUserQuota } = await import("@/lib/chat/quota");
      (checkUserQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        dailyTokensRemaining: 0,
        monthlyTokensRemaining: 0,
        dailyCostUsd: 0,
        reason: "daily_token_quota_exceeded",
      });

      const { validateChatRequest } = await import("@/lib/chat/validation");

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(validateChatRequest).not.toHaveBeenCalled();
    });
  });

  describe("error recovery", () => {
    it("continues when session activity update fails", async () => {
      const { updateSessionActivity } = await import("@/lib/chat/sessions");
      (updateSessionActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB timeout"),
      );

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("ok");
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
    });

    it("continues when user message save fails", async () => {
      const { saveMessage } = await import("@/lib/chat/sessions");
      (saveMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB insert failed"),
      );

      mockStreamText.mockResolvedValueOnce({
        toUIMessageStreamResponse: vi.fn(
          (opts: { headers?: Record<string, string> } | undefined) => {
            const resp = new Response("ok");
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
    });
  });

  describe("key rotation integration", () => {
    it("cooldowns the active key when the stream reports a quota error", async () => {
      const { reportKeyFailure, reportKeySuccess } = await import("@/lib/chat/key-rotator");

      mockStreamText.mockImplementationOnce(async (config) => {
        await config.onError?.({ error: new Error("429 RESOURCE_EXHAUSTED") });
        await config.onFinish?.({
          usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
          finishReason: "error",
        });
        return {
          toUIMessageStreamResponse: vi.fn(() => new Response("stream-error")),
        };
      });

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(reportKeyFailure).toHaveBeenCalledWith("integration-key");
      expect(reportKeySuccess).not.toHaveBeenCalled();
    });

    it("cooldowns a key on a synchronous quota failure without unsafe stream replay", async () => {
      const { isQuotaError } = await import("@/lib/chat/key-rotator");
      (isQuotaError as ReturnType<typeof vi.fn>).mockReturnValue(true);

      mockStreamText.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED"));

      const { POST } = await import("./route");
      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      expect(mockStreamText).toHaveBeenCalledTimes(1);
    });
  });
});
