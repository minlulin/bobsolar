import { getLedgerAccountOptions, getProjectOptions } from "@/actions/manual-journal-actions";
import { ManualJournalForm } from "./manual-journal-form";

export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage(): Promise<React.JSX.Element> {
  const [accountsResult, projectsResult] = await Promise.all([
    getLedgerAccountOptions(),
    getProjectOptions(),
  ]);

  return (
    <ManualJournalForm
      initialAccounts={accountsResult.success ? accountsResult.data : []}
      initialProjects={projectsResult.success ? projectsResult.data : []}
    />
  );
}
