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

let _serverEnv: z.infer<typeof serverEnvSchema> | null = null;
let _clientEnv: z.infer<typeof clientEnvSchema> | null = null;

export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (_serverEnv) return _serverEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server environment variables:");
    console.error(parsed.error.format());
    throw new Error(
      `Invalid server environment variables: ${JSON.stringify(parsed.error.format())}`,
    );
  }
  _serverEnv = parsed.data;
  return _serverEnv;
}

export function getClientEnv(): z.infer<typeof clientEnvSchema> {
  if (_clientEnv) return _clientEnv;
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
  });
  if (!parsed.success) {
    console.error("Invalid client environment variables:");
    console.error(parsed.error.format());
  }
  _clientEnv = parsed.data ?? { NEXT_PUBLIC_APP_URL: undefined };
  return _clientEnv;
}

// Backward compatibility getters (will be removed after migration)
export const serverEnv =
  process.env.NODE_ENV === "development"
    ? getServerEnv()
    : new Proxy({} as z.infer<typeof serverEnvSchema>, {
        get() {
          throw new Error("serverEnv accessed at module level - use getServerEnv() instead");
        },
      });

export const clientEnv = getClientEnv();
