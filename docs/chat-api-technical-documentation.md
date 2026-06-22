# Chat API — Technical Documentation

## API Reference

### POST /api/chat

Main chat endpoint for the BobSolar assistant bot. Processes user messages through
the Gemini AI model with knowledge base integration.

#### Authentication

Requires a valid session cookie (`bobsolar_session`). The session is validated
against the database for revocation status.

**Response: 401 Unauthorized**
```json
{ "error": "Authentication required" }
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messages | array | Yes | Array of message objects (1-100) |
| messages[].role | string | Yes | One of: `user`, `assistant` |
| messages[].content | string | No | Message text (max 10,000 chars) |
| messages[].parts | array | No | Alternative to content (max 20 parts) |
| brand | string | No | Inverter brand context (max 100 chars) |
| errorCode | string | No | Fault code context (max 100 chars) |
| conversationId | string | No | UUID of existing conversation |

#### Rate Limiting

The endpoint enforces multiple layers of rate limiting:

| Layer | Window | Max Requests | Response |
|-------|--------|--------------|----------|
| IP Throttle | 10 seconds | 3 | 429 with Retry-After |
| Per-User Rate Limit | 1 minute | 20 | 429 with X-RateLimit-* |
| Daily Token Quota | 24 hours | 500,000 tokens | 429 with X-Quota-* |
| Monthly Token Quota | 30 days | 5,000,000 tokens | 429 with X-Quota-* |

#### Response Headers

| Header | Description |
|--------|-------------|
| X-Chat-Session-Id | Session UUID for the conversation |
| X-Chat-Conversation-Id | Conversation UUID |
| X-RateLimit-Remaining | Remaining requests in current window |
| X-Quota-Daily-Remaining | Remaining daily tokens |
| X-Quota-Monthly-Remaining | Remaining monthly tokens |
| Retry-After | Seconds until retry (on 429/503) |

#### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid JSON | `{ "error": "Invalid JSON body" }` |
| 401 | No session | `{ "error": "Authentication required" }` |
| 422 | Validation failed | `{ "error": "Validation failed", "details": [...] }` |
| 429 | Rate limited | `{ "error": "...", "reason": "..." }` |
| 500 | Server error | `{ "error": "..." }` |
| 503 | All API keys exhausted | `{ "error": "All API keys are temporarily rate-limited" }` |

### GET /api/admin/key-status

Returns the status of all configured Gemini API keys. Requires admin authentication.

**Response: 200 OK**
```json
{
  "keys": [
    { "label": "primary", "available": true, "cooldownRemainingMs": 0 },
    { "label": "backup-1", "available": false, "cooldownRemainingMs": 45000 }
  ]
}
```

## Architecture

### Request Lifecycle

```
Client Request
  │
  ├─ 1. CSRF Check (production only)
  │     └─ Validates Origin/Referer header
  │
  ├─ 2. Authentication
  │     ├─ Unseal session cookie (iron-session)
  │     └─ Validate against DB (sv, role, archivedAt)
  │
  ├─ 3. IP Throttle
  │     └─ Count requests from IP in 10s window
  │
  ├─ 4. Per-User Rate Limit
  │     └─ Count user requests in 1m window
  │
  ├─ 5. Token Quota Check
  │     ├─ Daily: 500K tokens
  │     └─ Monthly: 5M tokens
  │
  ├─ 6. Request Validation (Zod)
  │     └─ Schema validation and sanitization
  │
  ├─ 7. Session & Conversation Management
  │     ├─ Create or load the client-selected conversation
  │     └─ Reuse an active session or create one
  │
  ├─ 8. Save User Message
  │
  ├─ 9. AI Processing
  │     ├─ Select the next available key
  │     ├─ Run brand/fault-filtered knowledge retrieval
  │     └─ Stream and persist the grounded assistant response
  │
  └─ 10. Usage Logging & Metrics
        ├─ Log tokens, cost, latency
        └─ Update in-memory metrics
```

### API Key Rotation

The system maintains a pool of up to 5 Gemini API keys:

- **Round-robin selection**: Each request selects the next available key
- **Automatic cooldown**: Keys that hit quota errors are cooldowned for 60 seconds
- **Safe streaming behavior**: A started streaming request is never replayed automatically
- **Next-request recovery**: After a stream quota error, later requests skip the cooldowned key
- **Non-quota errors**: Fail without rotating the current request

AI SDK streaming provider errors can occur after response streaming starts. Replaying the same
request would risk duplicate tool execution and duplicate output, so rotation applies to the next
request rather than pretending to provide unsafe in-request failover.

#### chat_conversations
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user |
| title | string | Auto-generated from first message |
| brand | string | Inverter brand context |
| last_error_code | string | Last fault code discussed |
| metadata | JSONB | Additional context |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last activity |

#### chat_messages
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| conversation_id | UUID | Parent conversation |
| user_id | UUID | Message author |
| role | enum | user/assistant/system |
| content | text | Message text |
| parts | JSONB | Structured message parts |
| parent_message_id | UUID | Threading support |
| metadata | JSONB | Brand, errorCode context |
| created_at | timestamp | Creation time |

#### chat_sessions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Session owner |
| conversation_id | UUID | Linked conversation |
| status | enum | active/expired/revoked |
| expires_at | timestamp | Session TTL (24h) |
| last_activity_at | timestamp | Last request time |
| ip_address | string | Client IP |
| user_agent | string | Client UA |

#### chat_usage_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Requesting user |
| session_id | UUID | Session reference |
| conversation_id | UUID | Conversation reference |
| model | string | Model used (with key label) |
| prompt_tokens | int | Input token count |
| completion_tokens | int | Output token count |
| total_tokens | int | Combined token count |
| cost_usd | decimal(10,6) | Computed cost |
| latency_ms | int | Request duration |
| error_code | string | Error type if failed |
| ip_address | string | Client IP |
| user_agent | string | Client UA |
| created_at | timestamp | Request time |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session signing secret (32+ chars) |
| `GEMINI_API_KEY_PRIMARY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_BACKUP_1` | No | Backup key 1 |
| `GEMINI_API_KEY_BACKUP_2` | No | Backup key 2 |
| `GEMINI_API_KEY_BACKUP_3` | No | Backup key 3 |
| `GEMINI_API_KEY_BACKUP_4` | No | Backup key 4 |

### Policy Constants

All policy constants are centralized in `src/lib/domain/policies.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `CHAT_RATE_LIMIT_WINDOW_MS` | 60,000 | Rate limit window (1 min) |
| `CHAT_RATE_LIMIT_MAX_REQUESTS` | 20 | Max requests per window |
| `CHAT_IP_THROTTLE_WINDOW_MS` | 10,000 | IP throttle window (10s) |
| `CHAT_IP_THROTTLE_MAX_REQUESTS` | 3 | Max requests per IP window |
| `CHAT_DAILY_TOKEN_QUOTA` | 500,000 | Daily token limit per user |
| `CHAT_MAX_MONTHLY_TOKEN_QUOTA` | 5,000,000 | Monthly token limit per user |
| `CHAT_KEY_ROTATION_COOLDOWN_MS` | 60,000 | Key cooldown period |
| `CHAT_DAILY_COST_ALERT_THRESHOLD_USD` | 5.0 | Daily cost alert threshold |
| `SESSION_TTL_MS` | 2,592,000,000 | Session duration (30 days) |

## Troubleshooting

### Common Issues

#### 401 Unauthorized
- Check that the session cookie is present and valid
- Verify `SESSION_SECRET` matches the one used to create the session
- Check if the user's `session_version` was bumped (password change, admin action)

#### 429 Rate Limited
- Check `Retry-After` header for wait time
- Review rate limit policy constants
- For token quota: check `chat_usage_logs` for usage history

#### 503 All API Keys Unavailable
- All Gemini API keys are on cooldown
- Check `/api/admin/key-status` for key availability
- Wait for cooldown period (default 60s) or add more keys

#### 500 Server Error
- Check server logs for detailed error
- Verify database connectivity
- Check Gemini API key validity

### Monitoring

The system exposes in-memory metrics via `src/lib/chat/metrics.ts`:

```typescript
import { getChatMetrics } from "@/lib/chat/metrics";

const metrics = getChatMetrics();
// metrics.tokens.daily.totalTokens
// metrics.cost.daily.totalUsd
// metrics.latency.p95Ms
// metrics.errors.count
// metrics.keyRotation.failoverCount
```

### Security Audit Trail

Security events are logged to the `audit_logs` table:

```sql
SELECT * FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

Event types: `login`, `logout`, `password_change`, `session_revoke`,
`csrf_blocked`, `rate_limit_hit`, `quota_exceeded`.
