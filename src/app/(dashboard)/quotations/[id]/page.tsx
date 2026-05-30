import { notFound } from "next/navigation";
import { getQuotation } from "@/actions/quotation-actions";
import { QuoteDetailView } from "./components/quote-detail-view";
import { QuoteEditorWrapper } from "./components/quote-editor-wrapper";

interface QuotationPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotationPage({
  params,
}: QuotationPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getQuotation(id);

  if (!res.success) {
    notFound();
  }

  const quotation = res.data;

  // If status is 'draft', we show the editor
  if (quotation.status === "draft") {
    return <QuoteEditorWrapper quotation={quotation} />;
  }

  // Otherwise, show the read-only detail view
  return <QuoteDetailView quotation={quotation} />;
}
