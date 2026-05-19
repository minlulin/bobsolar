import { getLedgerEntries, getLedgerProjects } from "@/actions/ledger-actions";
import { LedgerPageClient } from "./ledger-page-client";

export const dynamic = "force-dynamic";

export default async function LedgerPage(): Promise<React.JSX.Element> {
  const [ledgerResult, projectsResult] = await Promise.all([
    getLedgerEntries({ page: 1, limit: 50 }),
    getLedgerProjects(),
  ]);

  const initialLedger = ledgerResult.success ? ledgerResult.data : null;
  const initialProjects = projectsResult.success ? projectsResult.data : [];

  return <LedgerPageClient initialLedger={initialLedger} initialProjects={initialProjects} />;
}
