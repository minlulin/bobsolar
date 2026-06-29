"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { createInvoiceSchema } from "@/lib/validators/invoice";

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
}

interface CreateInvoiceFormProps {
  projectId: string;
  customerId?: string;
  customerName?: string;
  projectNumber?: string;
  prefillLines: Omit<InvoiceLine, "id">[];
  prefillTotal: string;
  existingInvoiceCount: number;
}

export function CreateInvoiceForm({
  projectId,
  prefillLines,
  prefillTotal,
  existingInvoiceCount,
}: CreateInvoiceFormProps): React.JSX.Element {
  const router = useRouter();
  const createInvoice = useCreateInvoice();

  const today = new Date().toISOString().split("T")[0] ?? "";
  const dueDateDefault =
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "";

  const [invoiceDate, setInvoiceDate] = React.useState(today);
  const [dueDate, setDueDate] = React.useState(dueDateDefault);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<InvoiceLine[]>(
    prefillLines.length > 0
      ? prefillLines.map((line) => ({ ...line, id: crypto.randomUUID() }))
      : [{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, taxAmount: 0 }],
  );

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number): void {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine(): void {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, taxAmount: 0 },
    ]);
  }

  function removeLine(index: number): void {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(ev: React.SyntheticEvent): void {
    ev.preventDefault();

    const parsed = createInvoiceSchema.safeParse({
      projectId,
      invoiceDate: new Date(invoiceDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxAmount: line.taxAmount,
      })),
      notes,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check invoice fields");
      return;
    }

    createInvoice.mutate(parsed.data, {
      onSuccess: (res) => {
        if (res.success) {
          router.push(`/projects/${projectId}`);
        }
      },
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const totalTax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = subtotal + totalTax;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {existingInvoiceCount > 0 && (
        <div className="bg-amber-500/15 border-amber-500/50 text-amber-200 rounded-2xl border px-6 py-4 text-sm font-semibold">
          Note: This project already has {existingInvoiceCount} posted invoice(s). Creating a new
          invoice will not affect existing ones.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-date">Invoice Date</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => (
            <div key={line.id} className="grid gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-5">
                <Label className="text-muted-foreground text-[10px] uppercase">Description</Label>
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(index, "description", e.target.value)}
                  required
                  placeholder="Item description"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-muted-foreground text-[10px] uppercase">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, "quantity", Math.max(1, Number(e.target.value)))
                  }
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-muted-foreground text-[10px] uppercase">Unit Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={line.unitPrice}
                  onChange={(e) =>
                    updateLine(index, "unitPrice", Math.max(0, Number(e.target.value)))
                  }
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-muted-foreground text-[10px] uppercase">Tax</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={line.taxAmount}
                  onChange={(e) =>
                    updateLine(index, "taxAmount", Math.max(0, Number(e.target.value)))
                  }
                />
              </div>
              <div className="flex items-end md:col-span-1">
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            Add Line Item
          </Button>

          <div className="border-border flex flex-col items-end gap-1 border-t pt-4">
            <p className="text-muted-foreground text-sm">
              Subtotal:{" "}
              <span className="font-mono font-semibold">{subtotal.toLocaleString()} MMK</span>
            </p>
            <p className="text-muted-foreground text-sm">
              Tax: <span className="font-mono font-semibold">{totalTax.toLocaleString()} MMK</span>
            </p>
            <p className="text-foreground text-lg font-bold">Total: {total.toLocaleString()} MMK</p>
            {prefillTotal && Number(prefillTotal) > 0 && (
              <p className="text-muted-foreground text-xs">
                Quoted total: {Number(prefillTotal).toLocaleString()} MMK
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createInvoice.isPending}>
          {createInvoice.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
