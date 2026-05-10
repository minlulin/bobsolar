import type { Metadata } from 'next';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from '@/actions/dashboard-actions';
import { DashboardPageHydrated } from './dashboard-page-hydrated';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardRootPage() {
  const queryClient = new QueryClient();

  const [stats, pipeline, activity, alerts] = await Promise.all([
    getDashboardStats(),
    getDashboardPipeline(),
    getRecentActivity(10),
    getUpcomingAlerts(5),
  ]);

  if (stats.success) {
    queryClient.setQueryData(['dashboard', 'stats'], stats.data);
  }
  if (pipeline.success) {
    queryClient.setQueryData(['dashboard', 'pipeline'], pipeline.data);
  }
  if (activity.success) {
    queryClient.setQueryData(['dashboard', 'activity', 10], activity.data);
  }
  if (alerts.success) {
    queryClient.setQueryData(['dashboard', 'alerts', 5], alerts.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <DashboardPageHydrated state={dehydratedState} />;
}
