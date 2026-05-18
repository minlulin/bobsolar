import { afterEach, describe, expect, it } from "vitest";
import { getSeedAdminCredentials } from "./seed-config";

function clearSeedEnv(): void {
  delete process.env["SEED_ADMIN_EMAIL"];
  delete process.env["SEED_ADMIN_PASSWORD"];
  delete process.env["ADMIN_EMAIL"];
  delete process.env["ADMIN_PASSWORD"];
}

describe("getSeedAdminCredentials", () => {
  afterEach(() => {
    clearSeedEnv();
  });

  it("prefers SEED_ADMIN_* variables when both styles are present", () => {
    process.env["SEED_ADMIN_EMAIL"] = "seed-admin@example.com";
    process.env["SEED_ADMIN_PASSWORD"] = "seed-password-123";
    process.env["ADMIN_EMAIL"] = "admin@example.com";
    process.env["ADMIN_PASSWORD"] = "admin-password-123";

    const credentials = getSeedAdminCredentials();
    expect(credentials.email).toBe("seed-admin@example.com");
    expect(credentials.password).toBe("seed-password-123");
  });

  it("falls back to ADMIN_* variables for compatibility", () => {
    process.env["ADMIN_EMAIL"] = "admin@example.com";
    process.env["ADMIN_PASSWORD"] = "admin-password-123";

    const credentials = getSeedAdminCredentials();
    expect(credentials.email).toBe("admin@example.com");
    expect(credentials.password).toBe("admin-password-123");
  });

  it("trims surrounding whitespace", () => {
    process.env["ADMIN_EMAIL"] = "  admin@example.com  ";
    process.env["ADMIN_PASSWORD"] = "  admin-password-123  ";

    const credentials = getSeedAdminCredentials();
    expect(credentials.email).toBe("admin@example.com");
    expect(credentials.password).toBe("admin-password-123");
  });
});
