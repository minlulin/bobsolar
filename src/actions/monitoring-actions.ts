"use server";

import { requireAdmin } from "@/lib/auth/validate";
import {
  type FinanceMetricsSnapshot,
  getFinanceMetrics,
  resetFinanceMetrics,
} from "@/lib/finance/metrics";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export async function getMonitoringMetrics(): Promise<ActionResponse<FinanceMetricsSnapshot>> {
  try {
    await requireAdmin();
    return successResponse(getFinanceMetrics());
  } catch (error) {
    return handleActionError(error, "getMonitoringMetrics", "Failed to fetch monitoring metrics");
  }
}

export async function resetMonitoringMetrics(): Promise<ActionResponse<{ reset: boolean }>> {
  try {
    await requireAdmin();
    resetFinanceMetrics();
    return successResponse({ reset: true });
  } catch (error) {
    return handleActionError(error, "resetMonitoringMetrics", "Failed to reset monitoring metrics");
  }
}
