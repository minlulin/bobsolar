const DATABASE_URL_KEYS = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const;

type DatabaseUrlKey = (typeof DATABASE_URL_KEYS)[number];

export function getDatabaseUrl(): string {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  throw new Error(
    `Database connection URL is not configured. Checked: ${DATABASE_URL_KEYS.join(', ')}`,
  );
}

export function getDatabaseUrlSource(): DatabaseUrlKey {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return key;
  }

  throw new Error(
    `Database connection URL is not configured. Checked: ${DATABASE_URL_KEYS.join(', ')}`,
  );
}
