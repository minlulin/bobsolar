import { useQuery } from "@tanstack/react-query";
import type { FinancePeriodFilter } from "@/actions/finance-dashboard-actions";
import {
  getDataConsistencyCheck,
  getExpenseBreakdown,
  getFinanceSummary,
  getMonthlyTrend,
  getReceivableRiskData,
} from "@/actions/finance-dashboard-actions";

const financeDashboardKeys = {
  all: ["finance-dashboard"] as const,
  summary: (filters: FinancePeriodFilter) =>
    [...financeDashboardKeys.all, "summary", filters] as const,
  trend: (filters: FinancePeriodFilter) => [...financeDashboardKeys.all, "trend", filters] as const,
  breakdown: (filters: FinancePeriodFilter) =>
    [...financeDashboardKeys.all, "breakdown", filters] as const,
  risk: () => [...financeDashboardKeys.all, "risk"] as const,
  consistency: () => [...financeDashboardKeys.all, "consistency"] as const,
};

export function useFinanceDashboardData(filters: FinancePeriodFilter = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.summary(filters),
    queryFn: async () => {
      const response = await getFinanceSummary(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 60 * 1000,
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
    staleTime: 60 * 1000,
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
    staleTime: 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });
}
