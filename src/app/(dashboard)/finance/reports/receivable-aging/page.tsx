import { getReceivableAgingReport } from "@/actions/receivable-aging-actions";
import { ReceivableAgingReportClient } from "./receivable-aging-client";

export const dynamic = "force-dynamic";

export default async function ReceivableAgingReportPage(): Promise<React.JSX.Element> {
  const result = await getReceivableAgingReport();

  return <ReceivableAgingReportClient initialReport={result.success ? result.data : null} />;
}
