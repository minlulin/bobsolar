/**
 * Business Policy Constants
 * Centralized to prevent drift and enable easy policy updates
 */

// =============================================================================
// SESSION & AUTHENTICATION
// =============================================================================

/** Session duration in milliseconds (30 days) */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Session duration in seconds (30 days) */
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

// =============================================================================
// FILE UPLOAD
// =============================================================================

/** Maximum file upload size in bytes (5MB) */
export const UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum file upload size in MB for display */
export const UPLOAD_MAX_SIZE_MB = 5;

/** Upload rate-limit window in milliseconds */
export const UPLOAD_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Maximum upload requests allowed per rate-limit window */
export const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 12;

// =============================================================================
// WARRANTY WINDOWS
// =============================================================================

/** Number of days for "due soon" warranty alerts */
export const WARRANTY_SOON_WINDOW_DAYS = 30;

/** Number of days for "expiring soon" quotation notifications */
export const QUOTATION_EXPIRY_WARNING_DAYS = 3;

/** Number of days for "due soon" warranty alert notifications */
export const WARRANTY_NOTIFICATION_WINDOW_DAYS = 7;

// =============================================================================
// BUDGET & COST
// =============================================================================

/**
 * Budget variance threshold multiplier.
 * Actual spend crossing 110% of quoted total triggers a notification.
 */
export const BUDGET_VARIANCE_THRESHOLD = 1.1;

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/** Maximum number of users allowed in the system */
export const USER_CAP = 10;

// =============================================================================
// API LIMITS
// =============================================================================

/** Default pagination limit for lists */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maximum pagination limit for lists */
export const MAX_PAGE_LIMIT = 100;

/** Safe limit for dashboard recent items */
export const DASHBOARD_RECENT_LIMIT = 30;

// =============================================================================
// AUTHENTICATION RATE LIMITING
// =============================================================================

/** Sliding window for counting auth attempts (15 minutes) */
export const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Maximum failed auth attempts before lockout */
export const AUTH_MAX_ATTEMPTS = 5;

/** Lockout duration after max attempts exceeded (15 minutes) */
export const AUTH_LOCK_MS = 15 * 60 * 1000;

/** Minimum response time for auth attempts to prevent timing attacks (ms) */
export const AUTH_MIN_RESPONSE_MS = 120;

// =============================================================================
// CHAT RATE LIMITING
// =============================================================================

/** Chat rate-limit window in milliseconds (1 minute) */
export const CHAT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Maximum chat messages allowed per rate-limit window */
export const CHAT_RATE_LIMIT_MAX_REQUESTS = 20;

/** Chat session duration in milliseconds (24 hours) */
export const CHAT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum messages per conversation before auto-archiving */
export const CHAT_MAX_MESSAGES_PER_CONVERSATION = 500;

/** Maximum active sessions per user */
export const CHAT_MAX_ACTIVE_SESSIONS_PER_USER = 5;

// =============================================================================
// CHAT COST TRACKING & QUOTAS
// =============================================================================

/**
 * Gemini 2.5 Flash pricing per 1M tokens (USD).
 * Standard paid tier, text/image/video input and output including thinking.
 * https://ai.google.dev/gemini-api/docs/pricing
 */
export const CHAT_MODEL_ID = "gemini-2.5-flash";
export const CHAT_EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const CHAT_MODEL_INPUT_COST_PER_MILLION_TOKENS = 0.3;
export const CHAT_MODEL_OUTPUT_COST_PER_MILLION_TOKENS = 2.5;

/** Maximum prompt tokens allowed per individual request */
export const CHAT_MAX_PROMPT_TOKENS_PER_REQUEST = 100_000;

/** Maximum completion tokens allowed per individual request */
export const CHAT_MAX_COMPLETION_TOKENS_PER_REQUEST = 8_192;

/** Maximum model steps: one retrieval call plus a final grounded answer. */
export const CHAT_MAX_TOOL_STEPS = 3;

/** Minimum cosine similarity accepted from semantic knowledge search. */
export const CHAT_KNOWLEDGE_SIMILARITY_THRESHOLD = 0.65;

/** Maximum knowledge chunks returned to the model per tool call. */
export const CHAT_KNOWLEDGE_RESULT_LIMIT = 3;

/** Daily token quota per user (input + output combined) */
export const CHAT_DAILY_TOKEN_QUOTA = 500_000;

/** Monthly token quota per user (input + output combined) */
export const CHAT_MAX_MONTHLY_TOKEN_QUOTA = 5_000_000;

/** Daily cost alert threshold in USD — logs warning when a user exceeds this */
export const CHAT_DAILY_COST_ALERT_THRESHOLD_USD = 5.0;

// =============================================================================
// CHAT ABUSE THROTTLING
// =============================================================================

/**
 * IP-based throttle window in milliseconds (10 seconds).
 * Prevents rapid-fire requests from a single IP regardless of auth state.
 */
export const CHAT_IP_THROTTLE_WINDOW_MS = 10_000;

/** Maximum requests per IP within the throttle window */
export const CHAT_IP_THROTTLE_MAX_REQUESTS = 3;

/** Global chat cooldown in milliseconds — applied after rate limit hit */
export const CHAT_GLOBAL_COOLDOWN_MS = 2_000;

// =============================================================================
// GEMINI API KEY ROTATION
// =============================================================================

/**
 * Cooldown period in milliseconds for a Gemini API key after it hits a
 * quota/rate-limit error. The key becomes available again after this period.
 * Default: 60 seconds (free-tier per-minute rate limit window).
 */
export const CHAT_KEY_ROTATION_COOLDOWN_MS = 60_000;
