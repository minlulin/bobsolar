import { TrialBalanceClient } from "./trial-balance-client";

export const dynamic = "force-dynamic";

export default function TrialBalancePage(): React.JSX.Element {
  return <TrialBalanceClient initialData={null} />;
}
