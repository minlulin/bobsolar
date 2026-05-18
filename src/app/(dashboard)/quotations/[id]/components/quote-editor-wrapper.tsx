"use client";

import * as React from "react";
import { QuoteEditor } from "@/app/(dashboard)/quotations/new/components/quote-editor";
import type { Customer, Quotation, QuotationItem } from "@/lib/db/schema";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

interface QuoteEditorWrapperProps {
  quotation: Quotation & { items: QuotationItem[]; customer: Customer };
}

export function QuoteEditorWrapper({ quotation }: QuoteEditorWrapperProps): React.JSX.Element {
  const loadFromQuotation = useQuoteBuilderStore((state) => state.loadFromQuotation);

  // Initialize store with existing quotation data
  React.useEffect(() => {
    loadFromQuotation(quotation);
  }, [quotation, loadFromQuotation]);

  return (
    <QuoteEditor
      mode="edit"
      quotationId={quotation.id}
      initialQuoteNumber={quotation.quoteNumber}
    />
  );
}
