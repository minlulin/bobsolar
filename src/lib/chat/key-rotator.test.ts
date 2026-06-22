import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock env vars before importing the module
const originalEnv = { ...process.env };

function setEnvKeys(keys: Record<string, string>) {
  for (const [k, v] of Object.entries(keys)) {
    process.env[k] = v;
  }
}

function clearEnvKeys() {
  const keyVars = [
    "GEMINI_API_KEY_PRIMARY",
    "GEMINI_API_KEY_BACKUP_1",
    "GEMINI_API_KEY_BACKUP_2",
    "GEMINI_API_KEY_BACKUP_3",
    "GEMINI_API_KEY_BACKUP_4",
  ];
  for (const k of keyVars) {
    delete process.env[k];
  }
}

describe("key-rotator", () => {
  beforeEach(() => {
    clearEnvKeys();
    // Reset module singleton between tests
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  describe("getNextKey", () => {
    it("returns the primary key when only one key is configured", async () => {
      setEnvKeys({ GEMINI_API_KEY_PRIMARY: "key-primary" });
      const { getNextKey } = await import("./key-rotator");
      const result = getNextKey();
      expect(result).toEqual({ key: "key-primary", label: "primary" });
    });

    it("returns keys in round-robin order", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
        GEMINI_API_KEY_BACKUP_2: "key-3",
      });
      const { getNextKey } = await import("./key-rotator");

      const first = getNextKey();
      expect(first).toEqual({ key: "key-1", label: "primary" });

      // After cooldown on primary, next should be backup-1
      const { reportKeyFailure } = await import("./key-rotator");
      reportKeyFailure("key-1");

      const second = getNextKey();
      expect(second).toEqual({ key: "key-2", label: "backup-1" });
    });

    it("skips keys that are on cooldown", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
        GEMINI_API_KEY_BACKUP_2: "key-3",
      });
      const { getNextKey, reportKeyFailure } = await import("./key-rotator");

      // Put primary on cooldown
      reportKeyFailure("key-1");

      const result = getNextKey();
      expect(result?.label).toBe("backup-1");
    });

    it("returns null when all keys are on cooldown", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
      });
      const { getNextKey, reportKeyFailure } = await import("./key-rotator");

      reportKeyFailure("key-1");
      reportKeyFailure("key-2");

      const result = getNextKey();
      expect(result).toBeNull();
    });

    it("throws when no keys are configured", async () => {
      const { getNextKey } = await import("./key-rotator");
      expect(() => getNextKey()).toThrow("No Gemini API keys configured");
    });

    it("loads up to 5 keys", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
        GEMINI_API_KEY_BACKUP_2: "key-3",
        GEMINI_API_KEY_BACKUP_3: "key-4",
        GEMINI_API_KEY_BACKUP_4: "key-5",
      });
      const { getKeyCount } = await import("./key-rotator");
      expect(getKeyCount()).toBe(5);
    });
  });

  describe("reportKeyFailure / reportKeySuccess", () => {
    it("places a key on cooldown when failure is reported", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
      });
      const { getNextKey, reportKeyFailure } = await import("./key-rotator");

      // First call returns primary
      expect(getNextKey()?.label).toBe("primary");

      // Report failure on primary
      reportKeyFailure("key-1");

      // Next call should skip primary
      expect(getNextKey()?.label).toBe("backup-1");
    });

    it("clears cooldown when success is reported", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
      });
      const { getNextKey, reportKeyFailure, reportKeySuccess } = await import("./key-rotator");

      reportKeyFailure("key-1");
      expect(getNextKey()?.label).toBe("backup-1");

      // Report success to clear cooldown
      reportKeySuccess("key-1");

      // Primary should be available again
      expect(getNextKey()?.label).toBe("primary");
    });
  });

  describe("isQuotaError", () => {
    it("detects HTTP 429 errors", async () => {
      const { isQuotaError } = await import("./key-rotator");
      expect(isQuotaError(new Error("429 Too Many Requests"))).toBe(true);
    });

    it("detects RESOURCE_EXHAUSTED errors", async () => {
      const { isQuotaError } = await import("./key-rotator");
      expect(isQuotaError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    });

    it("detects rate limit errors", async () => {
      const { isQuotaError } = await import("./key-rotator");
      expect(isQuotaError(new Error("rate limit exceeded"))).toBe(true);
    });

    it("returns false for non-quota errors", async () => {
      const { isQuotaError } = await import("./key-rotator");
      expect(isQuotaError(new Error("connection refused"))).toBe(false);
      expect(isQuotaError(new Error("invalid JSON"))).toBe(false);
    });
  });

  describe("getKeyStatus", () => {
    it("returns status for all configured keys", async () => {
      setEnvKeys({
        GEMINI_API_KEY_PRIMARY: "key-1",
        GEMINI_API_KEY_BACKUP_1: "key-2",
        GEMINI_API_KEY_BACKUP_2: "key-3",
      });
      const { getKeyStatus, reportKeyFailure } = await import("./key-rotator");

      reportKeyFailure("key-1");

      const status = getKeyStatus();
      expect(status).toHaveLength(3);
      expect(status[0]).toEqual({
        label: "primary",
        available: false,
        cooldownRemainingMs: expect.any(Number),
      });
      expect(status[1]).toEqual({ label: "backup-1", available: true, cooldownRemainingMs: 0 });
      expect(status[2]).toEqual({ label: "backup-2", available: true, cooldownRemainingMs: 0 });
    });
  });
});
