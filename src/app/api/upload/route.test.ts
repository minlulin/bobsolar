import { beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_RATE_LIMIT_MAX_REQUESTS } from "@/lib/domain/policies";

type RateLimitRow = {
  key: string;
  attempts: number;
  lockedUntil: Date | null;
  lastAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const state = vi.hoisted(() => ({
  currentUser: { userId: "user-1", role: "admin" as const },
  limitRow: null as RateLimitRow | null,
  inserted: null as null | Record<string, unknown>,
  updated: null as null | Record<string, unknown>,
  uploadedUrl: "https://blob.example.com/logos/logo.png",
}));

const spies = vi.hoisted(() => ({
  uploadFileFromBufferOrBlob: vi.fn(async () => state.uploadedUrl),
}));

vi.mock("@/lib/auth/validate", () => ({
  getCurrentUser: vi.fn(async () => state.currentUser),
}));

vi.mock("@/lib/storage/blob", () => ({
  uploadFileFromBufferOrBlob: spies.uploadFileFromBufferOrBlob,
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        query: {
          authRateLimits: {
            findFirst: vi.fn(async () => state.limitRow),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn(async (payload: Record<string, unknown>) => {
            state.inserted = payload;
          }),
        })),
        update: vi.fn(() => ({
          set: vi.fn((payload: Record<string, unknown>) => {
            state.updated = payload;
            return {
              where: vi.fn(async () => undefined),
            };
          }),
        })),
      };
      return await fn(tx);
    }),
  },
}));

function makeRequest(fileType = "image/png"): Request {
  const formData = new FormData();
  const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const file = new File([pngBytes], "logo.png", { type: fileType });
  formData.set("file", file);
  formData.set("folder", "logos");

  return {
    headers: new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-forwarded-for": "1.2.3.4",
    }),
    formData: async () => formData,
  } as unknown as Request;
}

describe("upload route distributed rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentUser = { userId: "user-1", role: "admin" };
    state.limitRow = null;
    state.inserted = null;
    state.updated = null;
    state.uploadedUrl = "https://blob.example.com/logos/logo.png";
  });

  it("allows upload and persists limiter state in DB on first request", async () => {
    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(makeRequest() as never);
    const body = (await response.json()) as { url?: string };

    expect(response.status).toBe(200);
    expect(body.url).toBe(state.uploadedUrl);
    expect(spies.uploadFileFromBufferOrBlob).toHaveBeenCalledOnce();
    expect(state.inserted).toMatchObject({
      key: "upload:user-1",
      attempts: 1,
    });
  });

  it("returns 429 when DB limiter window is exhausted", async () => {
    state.limitRow = {
      key: "upload:user-1",
      attempts: UPLOAD_RATE_LIMIT_MAX_REQUESTS,
      lockedUntil: new Date(Date.now() + 60_000),
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(makeRequest() as never);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(429);
    expect(body.error).toContain("Too many upload attempts");
    expect(spies.uploadFileFromBufferOrBlob).not.toHaveBeenCalled();
  });
});
