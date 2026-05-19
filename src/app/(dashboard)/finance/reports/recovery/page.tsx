import { getRecoveryReport } from "@/actions/recovery-actions";
import { RecoveryClient } from "./recovery-client";

export const dynamic = "force-dynamic";

export default async function RecoveryPage(): Promise<React.JSX.Element> {
  const result = await getRecoveryReport();

  return <RecoveryClient initialReport={result.success ? result.data : null} />;
}
