import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes with salt:key format", async () => {
    const hash = await hashPassword("secret123");
    const [salt, key] = hash.split(":");
    expect(salt).toBeDefined();
    expect(key).toBeDefined();
    expect(salt?.length).toBe(32);
    expect(key?.length).toBeGreaterThan(100);
  });

  it("verifies correct and rejects wrong password", async () => {
    const hash = await hashPassword("secret123");
    await expect(verifyPassword("secret123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects malformed hash", async () => {
    await expect(verifyPassword("x", "malformed")).resolves.toBe(false);
  });
});
