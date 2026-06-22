# Post-Deployment Monitoring Setup

## Monitoring Architecture

The chat system uses a lightweight, in-memory metrics collection system suitable
for free-tier deployment. Metrics reset on server restart.

## Application Insights

### Vercel Analytics

Vercel Analytics is integrated via `@vercel/analytics` and automatically tracks:
- Page views and navigation
- Web Vitals (LCP, FID, CLS)
- Geographic distribution

### Custom Metrics Endpoint

Create a monitoring dashboard that polls the in-memory metrics:

```typescript
// src/app/api/monitoring/metrics/route.ts
import { getChatMetrics } from "@/lib/chat/metrics";
import { requireAdmin } from "@/lib/auth/validate";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = getChatMetrics();
  return Response.json(metrics);
}
```

## Error Tracking

### Structured Logging

All errors are logged via `console.error` with structured context:

```
[Chat API] <component>: <message>
[Security Audit] Failed to log event: <error>
[KeyRotator] Key "<label>" placed on cooldown (<duration>s)
```

### Error Budget

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 0.1% | Investigate logs |
| Stream errors | > 5/min | Check Gemini API status |
| Auth failures | > 10/min | Check for attacks |
| Rate limit hits | > 50/min | Review quota settings |

## Performance Monitoring

### Key Metrics to Track

| Metric | Warning | Critical |
|--------|---------|----------|
| P95 Latency | > 5s | > 10s |
| Avg Latency | > 2s | > 5s |
| Key failovers | > 10/hour | > 50/hour |
| Daily cost per user | > $3 | > $5 |
| Token usage rate | > 80% quota | > 95% quota |

### Cost Alerts

The system logs cost alerts when a user's daily cost exceeds the threshold:

```
[Chat API Cost Alert] User <id> daily cost $X.XXXX exceeds threshold $5.00
```

Configure log-based alerts to notify administrators.

## User Analytics

### Usage Tracking

The `chat_usage_logs` table provides analytics data:

```sql
-- Daily active users
SELECT COUNT(DISTINCT user_id) as dau, DATE(created_at) as date
FROM chat_usage_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Average tokens per request
SELECT AVG(total_tokens) as avg_tokens,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_tokens) as p95_tokens
FROM chat_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Error rate
SELECT COUNT(*) FILTER (WHERE error_code IS NOT NULL) * 100.0 / COUNT(*) as error_rate
FROM chat_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Top users by token usage
SELECT user_id, SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost
FROM chat_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY total_tokens DESC
LIMIT 10;
```

### Conversation Analytics

```sql
-- Average conversation length
SELECT AVG(msg_count) as avg_messages
FROM (
  SELECT conversation_id, COUNT(*) as msg_count
  FROM chat_messages
  GROUP BY conversation_id
) sub;

-- Most discussed fault codes
SELECT details->>'errorCode' as fault_code, COUNT(*) as count
FROM chat_messages
WHERE details->>'errorCode' IS NOT NULL
GROUP BY details->>'errorCode'
ORDER BY count DESC
LIMIT 20;
```

## Health Checks

### Endpoint Monitoring

| Endpoint | Frequency | Expected |
|----------|-----------|----------|
| `/api/health` | Every 60s | 200 OK |
| `/api/admin/key-status` | Every 5 min | 200 OK with key data |

### Database Health

Monitor database connection pool:
- Connection count
- Query latency
- Error rate

## Alert Configuration

### Critical Alerts (Immediate)

1. **All API keys exhausted** — All Gemini keys on cooldown
2. **Database connection lost** — Unable to connect to PostgreSQL
3. **Error rate spike** > 1% — Potential service degradation

### Warning Alerts (Within 1 hour)

1. **High latency** — P95 > 5s for 5+ minutes
2. **Elevated failovers** — Key rotation failovers > 10/hour
3. **Cost threshold** — Any user exceeding daily cost alert
4. **Quota exhaustion** — Users hitting daily/monthly quotas

## Dashboard Recommendations

Create a monitoring dashboard with:

1. **Token Usage Chart** — Daily/monthly token consumption
2. **Cost Chart** — Daily cost per user and total
3. **Latency Chart** — P50, P95, P99 latency over time
4. **Error Rate Chart** — Error rate by type
5. **Key Status Panel** — Current availability of all API keys
6. **Active Users Panel** — Real-time active user count
7. **Rate Limit Panel** — Users currently rate-limited

## Incident Response

### High Latency Investigation

1. Check Gemini API status page
2. Review key rotation metrics (may indicate API issues)
3. Check database query performance
4. Review recent deployments for regressions

### Cost Spike Investigation

1. Identify top token consumers from usage logs
2. Check for abuse patterns (automated requests)
3. Review quota settings
4. Consider adjusting pricing thresholds

### Security Incident Response

1. Review audit logs for suspicious activity
2. Check for unusual IP patterns in usage logs
3. Verify CSRF protection is active
4. Review session revocation logs
5. Rotate API keys if compromise suspected
