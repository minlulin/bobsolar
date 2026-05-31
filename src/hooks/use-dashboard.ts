import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import {
  getDashboardPipeline,
  getDashboardStats,
  getFinanceQuickView,
  getRecentActivity,
  getUpcomingAlerts,
} from "@/actions/dashboard-actions";
import { STALE_TIME } from "@/lib/query-config";
import { dashboardKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";

type DashboardStats = ActionData<Awaited<ReturnType<typeof getDashboardStats>>>;
type DashboardPipeline = ActionData<Awaited<ReturnType<typeof getDashboardPipeline>>>;
type RecentActivity = ActionData<Awaited<ReturnType<typeof getRecentActivity>>>;
type UpcomingAlerts = ActionData<Awaited<ReturnType<typeof getUpcomingAlerts>>>;
type FinanceQuickView = ActionData<Awaited<ReturnType<typeof getFinanceQuickView>>>;

export function useDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const res = await getDashboardStats();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useDashboardPipeline(): UseQueryResult<DashboardPipeline> {
  return useQuery({
    queryKey: dashboardKeys.pipeline(),
    queryFn: async () => {
      const res = await getDashboardPipeline();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useRecentActivity(limit = 10): UseQueryResult<RecentActivity> {
  return useQuery({
    queryKey: dashboardKeys.activity(limit),
    queryFn: async () => {
      const res = await getRecentActivity(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    refetchOnWindowFocus: true,
  });
}

export function useUpcomingAlerts(limit = 5): UseQueryResult<UpcomingAlerts> {
  return useQuery({
    queryKey: dashboardKeys.alerts(limit),
    queryFn: async () => {
      const res = await getUpcomingAlerts(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useFinanceQuickView(): UseQueryResult<FinanceQuickView> {
  return useQuery({
    queryKey: dashboardKeys.financeQuickView(),
    queryFn: async () => {
      const res = await getFinanceQuickView();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}
