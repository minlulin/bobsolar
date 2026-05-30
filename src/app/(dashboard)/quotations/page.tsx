import { Plus } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { getQuotations } from "@/actions/quotation-actions";
import { Button } from "@/components/ui/button";
import { QuotationsGridClient } from "./components/quotations-grid-client";

export default async function QuotationsPage(): Promise<React.JSX.Element> {
  const res = await getQuotations({ page: 1, limit: 20 });
  const total = res.success ? res.data.total : 0;
  const initialItems = res.success ? res.data.items : [];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="surface-panel flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Quotations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage professional solar quotes for your clients.
          </p>
        </div>
        <Button asChild className="solar-cta">
          <Link href="/quotations/new">
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Link>
        </Button>
      </div>

      <QuotationsGridClient initialData={{ items: initialItems, total }} />
    </div>
  );
}
