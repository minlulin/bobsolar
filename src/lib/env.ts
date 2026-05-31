import { z } from "zod";

/**
 * Environment Variable SSoT
 * Centralized validation for all env vars. Import `serverEnv` / `clientEnv`
 * instead of accessing `process.env` directly.
 */

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

function validateServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server environment variables:");
    console.error(parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

function validateClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
  });
  if (!parsed.success) {
    console.error("Invalid client environment variables:");
    console.error(parsed.error.format());
  }
  return parsed.data;
}

export const serverEnv = validateServerEnv();
export const clientEnv = validateClientEnv();
