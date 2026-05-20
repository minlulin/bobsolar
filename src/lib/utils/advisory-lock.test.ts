import { describe, expect, it, vi } from "vitest";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";

describe("AdvisoryLock", () => {
  it("acquires and releases lock", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();
    await lock.release();

    expect(acquired).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("does not release when not acquired", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ locked: false }] });

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    const acquired = await lock.acquire();
    await lock.release();

    expect(acquired).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("swallows unlock errors", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockRejectedValueOnce(new Error("unlock failed"));

    const lock = new AdvisoryLock({ execute }, BigInt(42));
    await lock.acquire();

    await expect(lock.release()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
