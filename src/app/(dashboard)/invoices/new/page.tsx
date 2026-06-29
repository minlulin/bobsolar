import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type * as React from "react";
import { BackButton } from "@/components/shared/back-button";
import { getCurrentUser } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { CreateInvoiceForm } from "./components/create-invoice-form";

interface NewInvoicePageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewInvoicePage({
  searchParams,
}: NewInvoicePageProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 pt-12 pb-36">
        <BackButton />
        <p className="text-muted-foreground text-sm">You must be logged in to create an invoice.</p>
      </div>
    );
  }

  const { projectId } = await searchParams;

  if (!projectId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 pt-12 pb-36">
        <BackButton />
        <h1 className="font-heading text-3xl font-bold tracking-tighter">Create Invoice</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Select a completed project to create an invoice.
        </p>
      </div>
    );
  }

  // Fetch project with quotation items for pre-fill
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      customer: true,
      quotation: {
        with: {
          items: true,
        },
      },
      invoices: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Check if there's already a non-draft invoice
  const existingInvoices = project.invoices.filter(
    (inv) => inv.status !== "voided" && inv.status !== "draft",
  );

  // Pre-fill line items from quotation items
  const prefillLines =
    project.quotation?.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxAmount: 0,
    })) ?? [];

  const prefillTotal = project.quotedTotal;

  return (
    <div className="container mx-auto max-w-3xl px-4 pt-12 pb-36">
      <BackButton />
      <div className="mb-8 space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tighter">Create Invoice</h1>
        <p className="text-muted-foreground text-sm">
          Project: <span className="font-semibold">{project.projectNumber}</span> · Customer:{" "}
          <span className="font-semibold">{project.customer.name}</span>
        </p>
      </div>
      <CreateInvoiceForm
        projectId={project.id}
        customerId={project.customerId}
        customerName={project.customer.name}
        projectNumber={project.projectNumber}
        prefillLines={prefillLines}
        prefillTotal={prefillTotal}
        existingInvoiceCount={existingInvoices.length}
      />
    </div>
  );
}
