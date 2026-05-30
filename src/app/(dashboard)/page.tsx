import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import {
  getDashboardPipeline,
  getDashboardStats,
  getFinanceQuickView,
  getRecentActivity,
  getUpcomingAlerts,
} from "@/actions/dashboard-actions";
import { dashboardKeys } from "@/lib/query-keys";
import { DashboardPageHydrated } from "./dashboard-page-hydrated";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardRootPage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const [stats, pipeline, activity, alerts, financeQuickView] = await Promise.all([
    getDashboardStats(),
    getDashboardPipeline(),
    getRecentActivity(10),
    getUpcomingAlerts(4),
    getFinanceQuickView(),
  ]);

  if (stats.success) {
    queryClient.setQueryData(dashboardKeys.stats(), stats.data);
  }
  if (pipeline.success) {
    queryClient.setQueryData(dashboardKeys.pipeline(), pipeline.data);
  }
  if (activity.success) {
    queryClient.setQueryData(dashboardKeys.activity(10), activity.data);
  }
  if (alerts.success) {
    queryClient.setQueryData(dashboardKeys.alerts(4), alerts.data);
  }
  if (financeQuickView.success) {
    queryClient.setQueryData(dashboardKeys.financeQuickView(), financeQuickView.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <DashboardPageHydrated state={dehydratedState} />;
}
