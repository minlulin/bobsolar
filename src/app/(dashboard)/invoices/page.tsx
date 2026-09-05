import type { Metadata } from "next";
import { getInvoices } from "@/actions/invoice-actions";
import { InvoicesGridClient } from "./components/invoices-grid-client";

export const metadata: Metadata = {
  title: "Invoices",
};

export default async function InvoicesPage(): Promise<React.JSX.Element> {
  const response = await getInvoices({ tab: "open", page: 1, limit: 20 });

  const initialData = response.success
    ? response.data
    : {
        items: [],
        total: 0,
        summary: {
          open: 0,
          overdue: 0,
          draft: 0,
          paid: 0,
          voided: 0,
          openBalanceTotal: 0,
        },
      };

  return <InvoicesGridClient initialData={initialData} />;
}
