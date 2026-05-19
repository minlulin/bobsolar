import { getMonthEndCloseReport } from "@/actions/month-end-close-actions";
import { MonthEndCloseClient } from "./month-end-close-client";

export const dynamic = "force-dynamic";

export default async function MonthEndClosePage(): Promise<React.JSX.Element> {
  const now = new Date();
  const result = await getMonthEndCloseReport({ year: now.getFullYear(), month: now.getMonth() });

  return <MonthEndCloseClient initialReport={result.success ? result.data : null} />;
}
