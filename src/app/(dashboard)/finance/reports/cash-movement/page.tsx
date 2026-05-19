import { getCashMovementReport } from "@/actions/cash-movement-actions";
import { CashMovementReportClient } from "./cash-movement-client";

export const dynamic = "force-dynamic";

export default async function CashMovementReportPage(): Promise<React.JSX.Element> {
  const result = await getCashMovementReport();

  return <CashMovementReportClient initialReport={result.success ? result.data : null} />;
}
