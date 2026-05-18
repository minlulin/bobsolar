import { type UseQueryResult, useQuery } from "@tanstack/react-query";

type ActionData<T> = T extends { data: infer D } ? D : never;

type DashboardStats = ActionData<Awaited<ReturnType<typeof getDashboardStats>>>;
type DashboardPipeline = ActionData<Awaited<ReturnType<typeof getDashboardPipeline>>>;
type RecentActivity = ActionData<Awaited<ReturnType<typeof getRecentActivity>>>;
type UpcomingAlerts = ActionData<Awaited<ReturnType<typeof getUpcomingAlerts>>>;

import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from "@/actions/dashboard-actions";

export function useDashboardStats(): UseQueryResult<NonNullable<DashboardStats>> {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await getDashboardStats();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDashboardPipeline(): UseQueryResult<NonNullable<DashboardPipeline>> {
  return useQuery({
    queryKey: ["dashboard", "pipeline"],
    queryFn: async () => {
      const res = await getDashboardPipeline();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useRecentActivity(limit = 10): UseQueryResult<NonNullable<RecentActivity>> {
  return useQuery({
    queryKey: ["dashboard", "activity", limit],
    queryFn: async () => {
      const res = await getRecentActivity(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useUpcomingAlerts(limit = 5): UseQueryResult<NonNullable<UpcomingAlerts>> {
  return useQuery({
    queryKey: ["dashboard", "alerts", limit],
    queryFn: async () => {
      const res = await getUpcomingAlerts(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}
