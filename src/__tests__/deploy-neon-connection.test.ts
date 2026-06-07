import { describe, expect, it } from "vitest";

// ─── Test 1: next.config.mjs has serverExternalPackages for ws/pg ───────────

describe("Next.js bundling configuration", () => {
  it("next.config.mjs marks only current ws native addons as server external packages", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(require.resolve("../../next.config.mjs"), "utf-8");
    expect(src).toMatch(/serverExternalPackages/);
    expect(src).toMatch(/ws/);
    expect(src).toMatch(/bufferutil/);
    expect(src).toMatch(/utf-8-validate/);
    expect(src).not.toMatch(/@react-pdf\/renderer/);
  });
});

// ─── Test 2: DB module uses conditional ws (via require, not import) ────────

describe("DB module: conditional ws loading", () => {
  it("uses dynamic import for ws instead of top-level import", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(require.resolve("../../src/lib/db/index.ts"), "utf-8");
    // Should NOT have top-level `import ws from 'ws'`
    expect(src).not.toMatch(/import ws from 'ws'/);
    // Should use dynamic import with await import("ws")
    expect(src).toMatch(/await import\("ws"\)/);
    expect(src).toMatch(/typeof globalThis\.WebSocket/);
  });

  it("configures connectionTimeoutMillis for cold-start resilience", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(require.resolve("../../src/lib/db/index.ts"), "utf-8");
    expect(src).toMatch(/connectionTimeoutMillis/);
  });

  it("getDb and db proxy are exported", async () => {
    const mod = await import("@/lib/db");
    expect(mod.getDb).toBeInstanceOf(Function);
    expect(mod.db).toBeDefined();
  });
});

// ─── Test 3: bcryptjs import is correct (no native bcrypt) ─────────────────

describe("Password module: hashing implementation", () => {
  it("password functions exist and are async", async () => {
    const mod = await import("@/lib/auth/password");
    expect(typeof mod.hashPassword).toBe("function");
    expect(typeof mod.verifyPassword).toBe("function");
  });

  it("module source uses node crypto scrypt instead of bcrypt variants", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(require.resolve("../../src/lib/auth/password.ts"), "utf-8");
    expect(src).toMatch(/from "node:crypto"/);
    expect(src).toMatch(/scrypt/);
    expect(src).not.toMatch(/from 'bcrypt'/);
    expect(src).not.toMatch(/from 'bcryptjs'/);
  });
});
