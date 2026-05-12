import { z } from 'zod';

const CACHE_PREFIX = 'bobsolar';
const DEFAULT_TTL_SECONDS = 300;

const kvEnvSchema = z.object({
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),
});

function getKvEnv():
  | {
      url: string;
      token: string;
    }
  | null {
  const parsed = kvEnvSchema.safeParse({
    KV_REST_API_URL: process.env['KV_REST_API_URL'],
    KV_REST_API_TOKEN: process.env['KV_REST_API_TOKEN'],
  });
  if (!parsed.success) return null;
  return {
    url: parsed.data.KV_REST_API_URL.replace(/\/$/, ''),
    token: parsed.data.KV_REST_API_TOKEN,
  };
}

function namespacedKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

async function kvCommand<T>(command: string[]): Promise<T | null> {
  const env = getKvEnv();
  if (!env) return null;

  const response = await fetch(`${env.url}/${command.join('/')}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const json: unknown = await response.json();
  const parsed = z
    .object({
      result: z.unknown().nullable(),
    })
    .safeParse(json);

  if (!parsed.success) return null;
  return parsed.data.result as T | null;
}

export async function getCacheValue<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const raw = await kvCommand<unknown>([
    'get',
    encodeURIComponent(namespacedKey(key)),
  ]);
  if (raw === null) return null;
  const hydrated =
    typeof raw === 'string'
      ? z
          .string()
          .transform((value) => {
            try {
              return JSON.parse(value) as unknown;
            } catch {
              return value;
            }
          })
          .parse(raw)
      : raw;
  const parsed = schema.safeParse(hydrated);
  return parsed.success ? parsed.data : null;
}

export async function setCacheValue<T>(
  key: string,
  value: T,
  options?: { ttlSeconds?: number },
): Promise<void> {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  await kvCommand<unknown>([
    'set',
    encodeURIComponent(namespacedKey(key)),
    encodeURIComponent(JSON.stringify(value)),
    'EX',
    String(ttlSeconds),
  ]);
}

export async function deleteCacheValue(key: string): Promise<void> {
  await kvCommand<unknown>(['del', encodeURIComponent(namespacedKey(key))]);
}

export async function getOrSetCacheValue<T>(
  key: string,
  schema: z.ZodType<T>,
  loader: () => Promise<T>,
  options?: { ttlSeconds?: number },
): Promise<T> {
  const cached = await getCacheValue(key, schema);
  if (cached !== null) return cached;
  const loaded = await loader();
  await setCacheValue(key, loaded, options);
  return loaded;
}
