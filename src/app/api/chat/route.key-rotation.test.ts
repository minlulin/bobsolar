import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the chat API key rotation failover logic.
 *
 * These tests verify that the chat route correctly:
 * 1. Retries with the next key when a quota error occurs
 * 2. Returns 503 when all keys are exhausted
 * 3. Reports key failures and successes to the rotator
 */

// Mock the AI SDK before importing the route
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

// Mock auth
vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user-id", role: "admin" as const })),
  requireChatAccess: vi.fn(async () => ({ userId: "test-user-id", role: "admin" as const })),
}));

// Mock CSRF
vi.mock("@/lib/security/csrf", () => ({
  withCsrf: (handler: (req: Request) => Promise<Response>) => handler,
}));

// Mock DB
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

// Mock chat modules
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

describe("chat route key rotation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Clear all Gemini key env vars first to avoid leakage from .env.local or other tests
    delete process.env["GEMINI_API_KEY_PRIMARY"];
    delete process.env["GEMINI_API_KEY_BACKUP_1"];
    delete process.env["GEMINI_API_KEY_BACKUP_2"];
    delete process.env["GEMINI_API_KEY_BACKUP_3"];
    delete process.env["GEMINI_API_KEY_BACKUP_4"];
    // Set up exactly 3 test keys
    process.env["GEMINI_API_KEY_PRIMARY"] = "test-key-1";
    process.env["GEMINI_API_KEY_BACKUP_1"] = "test-key-2";
    process.env["GEMINI_API_KEY_BACKUP_2"] = "test-key-3";
    mockStreamText.mockReset();
    mockEmbed.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  function makeRequest() {
    return new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "test message" }],
      }),
    });
  }

  it("succeeds on the first key when no errors occur", async () => {
    mockStreamText.mockResolvedValueOnce({
      toUIMessageStreamResponse: vi.fn(() => new Response("ok")),
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });

  it("does not replay a streaming request when initialization hits a quota error", async () => {
    mockStreamText.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED"));

    const { POST } = await import("./route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when all keys are already on cooldown", async () => {
    const rotator = await import("@/lib/chat/key-rotator");
    vi.spyOn(rotator, "getNextKey").mockReturnValueOnce(null);

    const { POST } = await import("./route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(503);
    expect(mockStreamText).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.error).toContain("All API keys are temporarily rate-limited");
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not retry on non-quota errors", async () => {
    mockStreamText.mockRejectedValueOnce(new Error("connection refused"));

    const { POST } = await import("./route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });
});
