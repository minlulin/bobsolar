import { getProfitLossReport } from "@/actions/profit-loss-actions";
import { ProfitLossReportClient } from "./profit-loss-client";

export const dynamic = "force-dynamic";

export default async function ProfitLossReportPage(): Promise<React.JSX.Element> {
  const result = await getProfitLossReport();

  return <ProfitLossReportClient initialReport={result.success ? result.data : null} />;
}
