# Security Hardening Checklist

## Authorization

- [ ] Use explicit server-side policy helpers for privileged domain operations.
- [ ] Treat every exported server action as directly callable by authenticated clients.
- [ ] Enforce role checks in server actions (never rely on hidden/disabled UI controls).
- [ ] Add regression tests for unauthenticated, non-admin, and admin callers.

## Notifications & Navigation Safety

- [ ] Validate stored notification links as internal-only relative paths.
- [ ] Reject protocol-relative URLs, external schemes, backslashes, and control characters.
- [ ] Keep a client-side safety guard before navigation as a defense-in-depth measure.

## Scheduled / Maintenance Operations

- [ ] Protect maintenance jobs with admin/scheduler authorization.
- [ ] Prefer dedicated route handlers for cron with signed identity/secret verification.
- [ ] Ensure maintenance actions are not exposed as broad authenticated mutations.

## Data Access & Injection Safety

- [ ] Continue using Drizzle parameterized interpolation for dynamic SQL values.
- [ ] Do not use `sql.raw()` with untrusted input.
- [ ] Keep schema validation on all action inputs (`zod`).

## Operational Safety

- [ ] Add structured audit logging for privileged operations.
- [ ] Add alerting for repeated authorization failures and suspicious mutation patterns.
- [ ] Verify production environment variables (`SESSION_SECRET`, DB URL, app secrets) at startup.
- [ ] Ensure login keeps a safe fallback when optional branding/settings storage is unavailable.
