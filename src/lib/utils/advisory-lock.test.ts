import { describe, expect, it, vi } from "vitest";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";

describe("AdvisoryLock", () => {
  it("acquires and releases lock", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ locked: true }] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();
    await lock.release();

    expect(acquired).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not release when not acquired", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ locked: false }] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();
    await lock.release();

    expect(acquired).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
