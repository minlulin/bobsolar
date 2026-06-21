"use server";

import { requireAdmin } from "@/lib/auth/validate";
import { type ChatMetricsSnapshot, getChatMetrics, resetChatMetrics } from "@/lib/chat/metrics";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export async function getChatMonitoringMetrics(): Promise<ActionResponse<ChatMetricsSnapshot>> {
  try {
    await requireAdmin();
    return successResponse(getChatMetrics());
  } catch (error) {
    return handleActionError(
      error,
      "getChatMonitoringMetrics",
      "Failed to fetch chat monitoring metrics",
    );
  }
}

export async function resetChatMonitoringMetrics(): Promise<ActionResponse<{ reset: boolean }>> {
  try {
    await requireAdmin();
    resetChatMetrics();
    return successResponse({ reset: true });
  } catch (error) {
    return handleActionError(
      error,
      "resetChatMonitoringMetrics",
      "Failed to reset chat monitoring metrics",
    );
  }
}
