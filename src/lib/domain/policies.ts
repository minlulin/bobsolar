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
