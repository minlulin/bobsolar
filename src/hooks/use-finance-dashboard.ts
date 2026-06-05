import { useQuery } from "@tanstack/react-query";
import {
  type DataConsistencyCheck,
  type ExpenseBreakdownRow,
  type FinanceSummaryCard,
  getDataConsistencyCheck,
  getExpenseBreakdown,
  getFinanceSummary,
  getMonthlyTrend,
  getReceivableRiskData,
  type MonthlyTrendRow,
  type ReceivableRiskInvoice,
} from "@/actions/finance-dashboard-actions";
import { STALE_TIME } from "@/lib/query-config";
import { financeDashboardKeys } from "@/lib/query-keys";
import type { FinancePeriodFilter } from "@/lib/validators/finance";

export function useFinanceDashboardData(
  filters: FinancePeriodFilter = {},
  initialData?: FinanceSummaryCard,
) {
  return useQuery({
    queryKey: financeDashboardKeys.summary(filters),
    queryFn: async () => {
      const response = await getFinanceSummary(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    ...(initialData !== undefined && { initialData }),
  });
}

export function useMonthlyTrendData(
  filters: FinancePeriodFilter = {},
  initialData?: MonthlyTrendRow[],
) {
  return useQuery({
    queryKey: financeDashboardKeys.trend(filters),
    queryFn: async () => {
      const response = await getMonthlyTrend(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    ...(initialData !== undefined && { initialData }),
  });
}

export function useExpenseBreakdown(
  filters: FinancePeriodFilter = {},
  initialData?: ExpenseBreakdownRow[],
) {
  return useQuery({
    queryKey: financeDashboardKeys.breakdown(filters),
    queryFn: async () => {
      const response = await getExpenseBreakdown(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    ...(initialData !== undefined && { initialData }),
  });
}

export function useReceivableRiskData(initialData?: ReceivableRiskInvoice[]) {
  return useQuery({
    queryKey: financeDashboardKeys.risk(),
    queryFn: async () => {
      const response = await getReceivableRiskData();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
    ...(initialData !== undefined && { initialData }),
  });
}

export function useDataConsistencyCheck(initialData?: DataConsistencyCheck) {
  return useQuery({
    queryKey: financeDashboardKeys.consistency(),
    queryFn: async () => {
      const response = await getDataConsistencyCheck();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
    ...(initialData !== undefined && { initialData }),
  });
}
