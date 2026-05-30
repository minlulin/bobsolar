import { BalanceSheetClient } from "./balance-sheet-client";

export const dynamic = "force-dynamic";

export default function BalanceSheetPage(): React.JSX.Element {
  return <BalanceSheetClient initialData={null} />;
}
