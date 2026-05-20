import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (process.env as Record<string, string | undefined>)["KV_REST_API_URL"];
  delete (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN"];
  vi.stubGlobal("fetch", vi.fn());
});

describe("cache helpers", () => {
  it("returns null when KV env is missing", async () => {
    const { getCacheValue } = await import("@/lib/cache");
    const value = await getCacheValue("k", z.string());
    expect(value).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads and parses cached JSON string", async () => {
    (process.env as Record<string, string | undefined>)["KV_REST_API_URL"] =
      "https://kv.example.com";
    (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN"] = "token";

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: JSON.stringify({ a: 1 }) }),
    } as Response);

    const { getCacheValue } = await import("@/lib/cache");
    const value = await getCacheValue("obj", z.object({ a: z.number() }));

    expect(value).toEqual({ a: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("set and delete send KV commands with namespace and ttl", async () => {
    (process.env as Record<string, string | undefined>)["KV_REST_API_URL"] =
      "https://kv.example.com/base";
    (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN"] = "token";

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: "OK" }),
    } as Response);

    const { setCacheValue, deleteCacheValue } = await import("@/lib/cache");
    await setCacheValue("x", { ok: true }, { ttlSeconds: 99 });
    await deleteCacheValue("x");

    expect(fetch).toHaveBeenCalledTimes(2);
    const first = vi.mocked(fetch).mock.calls[0]?.[0];
    const second = vi.mocked(fetch).mock.calls[1]?.[0];
    expect(String(first)).toContain("set/bobsolar%3Ax");
    expect(String(first)).toContain("/EX/99");
    expect(String(second)).toContain("del/bobsolar%3Ax");
  });

  it("getOrSet loads and stores when cache miss", async () => {
    (process.env as Record<string, string | undefined>)["KV_REST_API_URL"] =
      "https://kv.example.com";
    (process.env as Record<string, string | undefined>)["KV_REST_API_TOKEN"] = "token";

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "OK" }) } as Response);

    const { getOrSetCacheValue } = await import("@/lib/cache");
    const loader = vi.fn(async () => ({ value: 7 }));
    const result = await getOrSetCacheValue("k", z.object({ value: z.number() }), loader);

    expect(result).toEqual({ value: 7 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
