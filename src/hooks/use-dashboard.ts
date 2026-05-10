import { useQuery } from '@tanstack/react-query';
import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from '@/actions/dashboard-actions';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await getDashboardStats();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDashboardPipeline() {
  return useQuery({
    queryKey: ['dashboard', 'pipeline'],
    queryFn: async () => {
      const res = await getDashboardPipeline();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: async () => {
      const res = await getRecentActivity(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useUpcomingAlerts(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'alerts', limit],
    queryFn: async () => {
      const res = await getUpcomingAlerts(limit);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}
