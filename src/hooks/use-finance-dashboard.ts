import { useQuery } from "@tanstack/react-query";
import {
  getDataConsistencyCheck,
  getExpenseBreakdown,
  getFinanceSummary,
  getMonthlyTrend,
  getReceivableRiskData,
} from "@/actions/finance-dashboard-actions";
import { STALE_TIME } from "@/lib/query-config";
import { financeDashboardKeys } from "@/lib/query-keys";
import type { FinancePeriodFilter } from "@/lib/validators/finance";

export function useFinanceDashboardData(filters: FinancePeriodFilter = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.summary(filters),
    queryFn: async () => {
      const response = await getFinanceSummary(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useMonthlyTrendData(filters: FinancePeriodFilter = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.trend(filters),
    queryFn: async () => {
      const response = await getMonthlyTrend(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useExpenseBreakdown(filters: FinancePeriodFilter = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.breakdown(filters),
    queryFn: async () => {
      const response = await getExpenseBreakdown(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useReceivableRiskData() {
  return useQuery({
    queryKey: financeDashboardKeys.risk(),
    queryFn: async () => {
      const response = await getReceivableRiskData();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
  });
}

export function useDataConsistencyCheck() {
  return useQuery({
    queryKey: financeDashboardKeys.consistency(),
    queryFn: async () => {
      const response = await getDataConsistencyCheck();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
  });
}
