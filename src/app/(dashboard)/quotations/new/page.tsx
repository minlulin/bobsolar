import { getCompanySettings } from "@/actions/settings-actions";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { QuoteEditor } from "./components/quote-editor";

export default async function NewQuotationPage(): Promise<React.JSX.Element> {
  const settingsRes = await getCompanySettings();
  const defaultTerms = settingsRes.success
    ? settingsRes.data[COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS]
    : undefined;

  return <QuoteEditor mode="create" defaultNotes={defaultTerms} />;
}
