import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  formatErrorMessage,
  getErrorCode,
  handleActionError,
  handleNotFoundError,
  handleStateError,
  logError,
} from "@/lib/utils/error";

describe("error utils", () => {
  it("maps known error codes", () => {
    expect(getErrorCode(new Error("Unauthorized request"))).toBe("UNAUTHORIZED");
    expect(getErrorCode(new Error("record not found"))).toBe("NOT_FOUND");
    expect(getErrorCode(new Error("database transaction failed"))).toBe("DB_ERROR");
    expect(getErrorCode(new Error("permission denied"))).toBe("FORBIDDEN");
    expect(getErrorCode("x")).toBe("UNKNOWN");
  });

  it("formats error message with fallback", () => {
    expect(formatErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(formatErrorMessage("oops", "fallback")).toBe("fallback");

    const schema = z.object({ id: z.string().uuid() });
    const parsed = schema.safeParse({ id: "not-uuid" });
    if (!parsed.success) {
      expect(formatErrorMessage(parsed.error, "fallback").length).toBeGreaterThan(0);
    }
  });

  it("logs safely with bigint and circular refs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new Error("db fail");
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(() =>
      logError("test", err, {
        count: 1n,
        circular,
      }),
    ).not.toThrow();

    expect(spy).toHaveBeenCalledOnce();
    const payload = String(spy.mock.calls[0]?.[0] ?? "");
    expect(payload).toContain("db fail");
    expect(payload).toContain('"count": "1"');
    expect(payload).toContain("[Circular]");
    spy.mockRestore();
  });

  it("builds action error response", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const dev = process.env["NODE_ENV"];
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "development";
    const caused = new Error("outer", { cause: new Error("inner") });
    const res = handleActionError(caused, "ctx", "fallback");
    expect(res.success).toBe(false);
    expect(res.error).toContain("outer");
    expect(res.error).toContain("inner");

    (process.env as Record<string, string | undefined>)["NODE_ENV"] = dev;
    spy.mockRestore();
  });

  it("builds not found/state helpers", () => {
    const n = handleNotFoundError("Project", "123");
    const s = handleStateError("Invalid state");
    expect(n.success).toBe(false);
    expect(n.error).toContain("Project");
    expect(s.success).toBe(false);
    expect(s.error).toBe("Invalid state");
  });
});
