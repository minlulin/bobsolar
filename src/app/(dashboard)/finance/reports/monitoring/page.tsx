import { getMonitoringMetrics } from "@/actions/monitoring-actions";
import { MonitoringClient } from "./monitoring-client";

export const dynamic = "force-dynamic";

export default async function MonitoringPage(): Promise<React.JSX.Element> {
  const result = await getMonitoringMetrics();

  return <MonitoringClient initialMetrics={result.success ? result.data : null} />;
}
