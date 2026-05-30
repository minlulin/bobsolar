import {
  getDataConsistencyCheck,
  getExpenseBreakdown,
  getFinanceSummary,
  getMonthlyTrend,
  getReceivableRiskData,
} from "@/actions/finance-dashboard-actions";
import { FinanceDashboardClient } from "./finance-dashboard-client";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage(): Promise<React.JSX.Element> {
  const [summaryResult, trendResult, breakdownResult, riskResult, consistencyResult] =
    await Promise.all([
      getFinanceSummary(),
      getMonthlyTrend(),
      getExpenseBreakdown(),
      getReceivableRiskData(),
      getDataConsistencyCheck(),
    ]);

  return (
    <FinanceDashboardClient
      initialSummary={summaryResult.success ? summaryResult.data : null}
      initialTrend={trendResult.success ? trendResult.data : []}
      initialBreakdown={breakdownResult.success ? breakdownResult.data : []}
      initialRisk={riskResult.success ? riskResult.data : []}
      initialConsistency={consistencyResult.success ? consistencyResult.data : null}
    />
  );
}
