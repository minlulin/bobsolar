import { describe, expect, it, vi } from "vitest";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";

describe("AdvisoryLock", () => {
  it("acquires lock successfully", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ locked: true }] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();

    expect(acquired).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("handles lock busy", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ locked: false }] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();

    expect(acquired).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
