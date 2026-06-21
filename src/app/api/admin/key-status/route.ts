import { requireAdmin } from "@/lib/auth/validate";
import { getKeyCount, getKeyStatus } from "@/lib/chat/key-rotator";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/key-status
 *
 * Returns the current availability status of all configured Gemini API keys.
 * Requires admin authentication.
 *
 * Response:
 * {
 *   "keys": [
 *     { "label": "primary", "available": true, "cooldownRemainingMs": 0 },
 *     { "label": "backup-1", "available": false, "cooldownRemainingMs": 45000 },
 *     ...
 *   ],
 *   "totalKeys": 3
 * }
 */
export async function GET() {
  await requireAdmin();

  return Response.json({
    keys: getKeyStatus(),
    totalKeys: getKeyCount(),
  });
}
