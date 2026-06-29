-- Expand audit_action enum to include security event types (Fix #4)
-- Previously csrf_blocked, rate_limit_hit, quota_exceeded were silently
-- stored as session_revoke, corrupting audit analytics.

ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'csrf_blocked';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'rate_limit_hit';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'quota_exceeded';
