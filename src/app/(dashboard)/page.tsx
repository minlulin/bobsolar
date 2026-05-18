import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from "@/actions/dashboard-actions";
import { DashboardPageHydrated } from "./dashboard-page-hydrated";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardRootPage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const stats = await getDashboardStats();
  const pipeline = await getDashboardPipeline();
  const activity = await getRecentActivity(10);
  const alerts = await getUpcomingAlerts(5);

  if (stats.success) {
    queryClient.setQueryData(["dashboard", "stats"], stats.data);
  }
  if (pipeline.success) {
    queryClient.setQueryData(["dashboard", "pipeline"], pipeline.data);
  }
  if (activity.success) {
    queryClient.setQueryData(["dashboard", "activity", 10], activity.data);
  }
  if (alerts.success) {
    queryClient.setQueryData(["dashboard", "alerts", 5], alerts.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <DashboardPageHydrated state={dehydratedState} />;
}
