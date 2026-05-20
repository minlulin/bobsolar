import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Ensure `.env.local` is available to tests (TEST_DATABASE_URL, SESSION_SECRET, etc.)
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/__tests__/**",
        "src/app/**",
        "src/components/**",
        "src/hooks/**",
        "src/lib/db/schema.ts",
        "src/lib/db/index.ts",
      ],
    },
  },
});
