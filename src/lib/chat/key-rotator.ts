/**
 * Gemini API key rotator with automatic failover.
 *
 * Maintains a rotating pool of Gemini API keys. When a key hits a quota
 * error (HTTP 429 / RESOURCE_EXHAUSTED), it is temporarily cooldowned and
 * the next key is used. Keys recover from cooldown after a configurable period.
 *
 * Environment variables:
 *   GEMINI_API_KEY_PRIMARY  - First key (default)
 *   GEMINI_API_KEY_BACKUP_1 - Second key
 *   GEMINI_API_KEY_BACKUP_2 - Third key
 *   GEMINI_API_KEY_BACKUP_3 - Fourth key (optional)
 *   GEMINI_API_KEY_BACKUP_4 - Fifth key (optional)
 *
 * All keys must be valid Gemini API keys from separate Google accounts
 * to provide independent quota pools.
 */

import {
  CHAT_KEY_ROTATION_COOLDOWN_MS,
  CHAT_KEY_ROTATION_MAX_RETRIES,
} from "@/lib/domain/policies";

interface KeyState {
  key: string;
  label: string;
  cooldownUntil: number | null;
}

function loadKeys(): KeyState[] {
  const raw: Array<{ envKey: string; label: string }> = [
    { envKey: "GEMINI_API_KEY_PRIMARY", label: "primary" },
    { envKey: "GEMINI_API_KEY_BACKUP_1", label: "backup-1" },
    { envKey: "GEMINI_API_KEY_BACKUP_2", label: "backup-2" },
    { envKey: "GEMINI_API_KEY_BACKUP_3", label: "backup-3" },
    { envKey: "GEMINI_API_KEY_BACKUP_4", label: "backup-4" },
  ];

  const keys: KeyState[] = [];
  for (const { envKey, label } of raw) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) {
      keys.push({ key: value.trim(), label, cooldownUntil: null });
    }
  }

  if (keys.length === 0) {
    throw new Error(
      "[KeyRotator] No Gemini API keys configured. Set at least GEMINI_API_KEY_PRIMARY.",
    );
  }

  return keys;
}

// Singleton state shared across requests within the same process.
// In serverless (Vercel), each invocation gets its own state, which is
// acceptable — cooldowns are best-effort and recover quickly.
let _keys: KeyState[] | null = null;

function getKeys(): KeyState[] {
  if (!_keys) _keys = loadKeys();
  return _keys;
}

/** Check if a key is currently available (not in cooldown). */
function isAvailable(k: KeyState): boolean {
  if (!k.cooldownUntil) return true;
  if (Date.now() >= k.cooldownUntil) {
    k.cooldownUntil = null; // auto-recover
    return true;
  }
  return false;
}

/** Place a key into cooldown. */
function cooldown(k: KeyState): void {
  k.cooldownUntil = Date.now() + CHAT_KEY_ROTATION_COOLDOWN_MS;
}

/**
 * Get the next available API key using round-robin selection.
 *
 * Returns { key, label } or null if all keys are exhausted.
 */
export function getNextKey(): { key: string; label: string } | null {
  const keys = getKeys();
  const available = keys.filter(isAvailable);

  if (available.length === 0) {
    // All keys on cooldown — try to recover the one that cooled down first
    const oldest = keys.reduce((a, b) => ((a.cooldownUntil ?? 0) < (b.cooldownUntil ?? 0) ? a : b));
    if (oldest.cooldownUntil && Date.now() >= oldest.cooldownUntil) {
      oldest.cooldownUntil = null;
      return { key: oldest.key, label: oldest.label };
    }
    return null;
  }

  // Round-robin: pick the first available key.
  // As keys cycle through cooldown, natural rotation occurs.
  const first = available[0];
  if (!first) return null;
  return { key: first.key, label: first.label };
}

/**
 * Report that a key hit a quota/rate-limit error.
 * The key is placed into cooldown.
 */
export function reportKeyFailure(key: string): void {
  const keys = getKeys();
  const found = keys.find((k) => k.key === key);
  if (found) {
    cooldown(found);
    console.warn(
      `[KeyRotator] Key "${found.label}" placed on cooldown (${CHAT_KEY_ROTATION_COOLDOWN_MS / 1000}s) due to quota/rate-limit error.`,
    );
  }
}

/**
 * Report that a key was used successfully.
 * Clears its cooldown so it becomes available again.
 */
export function reportKeySuccess(key: string): void {
  const keys = getKeys();
  const found = keys.find((k) => k.key === key);
  if (found) {
    found.cooldownUntil = null;
  }
}

/**
 * Check whether an error from the Gemini API is a quota/rate-limit error.
 * Handles both HTTP 429 responses and the error shapes thrown by the AI SDK.
 */
export function isQuotaError(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("Rate limit") ||
    msg.includes("rate_limit")
  );
}

/**
 * Get status of all keys for monitoring.
 */
export function getKeyStatus(): Array<{
  label: string;
  available: boolean;
  cooldownRemainingMs: number;
}> {
  const keys = getKeys();
  const now = Date.now();
  return keys.map((k) => ({
    label: k.label,
    available: isAvailable(k),
    cooldownRemainingMs: k.cooldownUntil ? Math.max(0, k.cooldownUntil - now) : 0,
  }));
}

/**
 * Get the total number of configured keys.
 */
export function getKeyCount(): number {
  return getKeys().length;
}

/**
 * Get the max retry count for key rotation.
 */
export function getMaxRetries(): number {
  return Math.min(CHAT_KEY_ROTATION_MAX_RETRIES, getKeys().length);
}
