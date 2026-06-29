"use client";

import { format } from "date-fns";
import { ChevronLeft, Copy, Download, ExternalLink, MapPin, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  createQuotationRevision,
  deleteQuotation,
  duplicateQuotation,
  updateQuotationStatus,
} from "@/actions/quotation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, Quotation, QuotationItem } from "@/lib/db/schema";
import { cn, formatMMK } from "@/lib/utils";
import { groupQuotationItems } from "@/lib/utils/quotation-grouping";
import { ConvertToProjectDialog } from "./convert-to-project-dialog";

const QuotePreview = dynamic(
  () =>
    import("@/app/(dashboard)/quotations/new/components/quote-preview").then(
      (mod) => mod.QuotePreview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border-border/60 bg-muted/20 flex aspect-[1/1.414] w-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="text-muted-foreground mt-2 text-[10px] font-bold tracking-wider uppercase">
          Loading Live Preview...
        </p>
      </div>
    ),
  },
);

import { showLinkedToast } from "@/components/shared/toast-link";
import { STATUS_CONFIG } from "@/lib/constants";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

interface QuoteDetailViewProps {
  quotation: Quotation & {
    items: (QuotationItem & { inventoryItem: { category: string } | null })[];
    customer: Customer;
    project?: { id: string; projectNumber: string } | null;
  };
  revisions?: Quotation[];
}

export function QuoteDetailView({ quotation, revisions }: QuoteDetailViewProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = React.useOptimistic<
    Quotation["status"],
    Quotation["status"]
  >(quotation.status, (_prev, next) => next);
  const loadFromQuotation = useQuoteBuilderStore((state) => state.loadFromQuotation);
  const [revisionDialogOpen, setRevisionDialogOpen] = React.useState(false);
  const [revisionReason, setRevisionReason] = React.useState("");

  const handleRevise = (): void => {
    if (!revisionReason.trim()) {
      toast.error("Please enter a reason for revision");
      return;
    }
    startTransition(async () => {
      const res = await createQuotationRevision({
        originalQuotationId: quotation.id,
        revisionReason: revisionReason.trim(),
        customerId: quotation.customerId,
        discountPercent: Number(quotation.discountPercent),
        taxPercent: Number(quotation.taxPercent),
        notes: quotation.notes,
        validUntil: quotation.validUntil ? new Date(quotation.validUntil) : null,
        quotationDate: quotation.quotationDate ? new Date(quotation.quotationDate) : null,
        items: quotation.items.map((item) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountPercentage: Number(item.discountPercentage),
          sortOrder: item.sortOrder,
        })),
      });
      if (res.success) {
        toast.success("New revision created as draft");
        setRevisionDialogOpen(false);
        setRevisionReason("");
        router.push(`/quotations/${res.data.id}`);
      } else {
        toast.error(res.error || "Failed to create revision");
      }
    });
  };

  const handleStatusChange = (newStatus: Quotation["status"]): void => {
    const previousStatus = optimisticStatus;
    setOptimisticStatus(newStatus);
    startTransition((): void => {
      void (async (): Promise<void> => {
        try {
          const res = await updateQuotationStatus(quotation.id, newStatus);
          if (res.success) {
            showLinkedToast({
              title: `Status updated to ${newStatus}`,
              description: "The sales pipeline has been updated.",
              href: `/quotations/${quotation.id}`,
              variant: "success",
            });
            router.refresh();
            return;
          }

          setOptimisticStatus(previousStatus);
          toast.error(res.error);
        } catch {
          setOptimisticStatus(previousStatus);
          toast.error("Failed to update quotation status");
        }
      })();
    });
  };

  const handleDuplicate = (): void => {
    startTransition(async () => {
      const res = await duplicateQuotation(quotation.id);
      if (res.success) {
        toast.success("Quotation duplicated as draft");
        router.push(`/quotations/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (): void => {
    startTransition(async () => {
      const res = await deleteQuotation(quotation.id);
      if (res.success) {
        toast.success("Quotation deleted");
        router.push("/quotations");
      } else {
        toast.error(res.error || "Failed to delete quotation");
      }
    });
  };

  const status = optimisticStatus;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  React.useEffect(() => {
    loadFromQuotation(quotation);
  }, [quotation, loadFromQuotation]);

  const displayItems = React.useMemo(() => {
    const itemsWithCategory = quotation.items.map((item) => ({
      ...item,
      category: item.inventoryItem?.category || null,
    }));
    return groupQuotationItems(itemsWithCategory);
  }, [quotation.items]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
      {/* Immersive Header */}
      <div className="border-border bg-card col-span-12 flex flex-col items-start justify-between gap-2 rounded-2xl border p-8 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              router.push("/quotations");
            }}
            className="bg-muted/30 border-border h-12 w-12 rounded-xl border shadow-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-primary text-3xl font-black tracking-tighter uppercase">
                {quotation.quoteNumber}
              </h1>
              <Badge
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-bold tracking-widest uppercase",
                  config.color,
                )}
              >
                <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                {config.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              Documented by System on {format(new Date(quotation.createdAt), "MMMM dd, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status === "draft" && (
            <>
              <Button
                onClick={() => {
                  router.push(`/quotations/${quotation.id}/edit`);
                }}
                disabled={isPending}
                className="h-12 rounded-xl bg-blue-600 px-6 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
              >
                Edit Quote
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isPending}
                variant="destructive"
                className="h-12 rounded-xl px-6 font-bold shadow-lg"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}

          {status === "sent" && (
            <>
              <Button
                onClick={handleDelete}
                disabled={isPending}
                variant="destructive"
                className="h-12 rounded-xl px-6 font-bold shadow-lg"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button
                onClick={() => {
                  handleStatusChange("accepted");
                }}
                disabled={isPending}
                className="h-12 rounded-xl bg-emerald-600 px-6 font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
              >
                Approve & Finalize
              </Button>
            </>
          )}

          {(status === "sent" || status === "rejected") && (
            <Button
              onClick={() => setRevisionDialogOpen(true)}
              disabled={isPending}
              className="h-12 rounded-xl bg-amber-600 px-6 font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-700"
            >
              Revise Quote
            </Button>
          )}

          {status === "accepted" && !quotation.project && (
            <ConvertToProjectDialog quotation={quotation}>
              <Button className="bg-accent hover:bg-accent/90 shadow-accent/20 h-12 rounded-xl px-6 font-bold text-white shadow-lg">
                <ExternalLink className="mr-2 h-4 w-4" />
                Initialize Project
              </Button>
            </ConvertToProjectDialog>
          )}

          {status === "accepted" && quotation.project && (
            <Button
              asChild
              variant="secondary"
              className="border-border bg-primary/5 text-primary h-12 rounded-xl border px-6 font-bold"
            >
              <Link href={`/projects/${quotation.project.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Project #{quotation.project.projectNumber}
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            className="border-border bg-muted/20 h-12 rounded-xl border px-4 font-bold"
            onClick={() => {
              window.open(`/quotations/${quotation.id}/pdf`, "_blank");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>

          <a
            href={`/quotations/${quotation.id}/pdf?download=1`}
            download={`QUOTE-${quotation.quoteNumber}.html`}
          >
            <Button
              variant="outline"
              className="border-border bg-muted/20 h-12 rounded-xl border px-4 font-bold"
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </a>

          <Button
            variant="ghost"
            size="icon"
            className="border-border bg-muted/10 h-12 w-12 rounded-xl border"
            onClick={handleDuplicate}
            disabled={isPending}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Bento */}
      <div className="col-span-12 space-y-6 lg:col-span-8">
        {/* Customer Module */}
        <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
          <h3 className="text-accent mb-6 text-xs font-bold tracking-[0.2em] uppercase">
            Client Specification
          </h3>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Full Name
              </p>
              <p className="text-primary text-xl font-bold">{quotation.customer.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Contact Line
              </p>
              <p className="text-primary text-lg font-bold">{quotation.customer.phone}</p>
              <p className="text-muted-foreground text-xs">
                {quotation.customer.email || "No email provided"}
              </p>
            </div>
            <div className="border-border/50 col-span-full space-y-1 border-t pt-4">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Installation Address
              </p>
              <div className="flex items-start gap-2 text-sm font-medium">
                <MapPin className="text-accent mt-1 h-4 w-4" />
                <p>
                  {quotation.customer.address}, {quotation.customer.city}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Items Module */}
        <div className="border-border bg-card overflow-hidden rounded-2xl border p-0 shadow-sm">
          <div className="p-8 pb-0">
            <h3 className="text-accent mb-6 text-xs font-bold tracking-[0.2em] uppercase">
              Infrastructure Components
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-border/50 text-muted-foreground border-y text-[10px] font-bold tracking-widest uppercase">
                  <th className="px-8 py-4 text-left">Component Description</th>
                  <th className="w-24 px-4 py-4 text-center">Qty</th>
                  <th className="w-40 px-4 py-4 text-right">Unit Price</th>
                  <th className="w-40 px-8 py-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-border/30 divide-y">
                {displayItems.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/2 transition-colors">
                    <td className="px-8 py-5">
                      {item.category ? (
                        <Badge
                          variant="outline"
                          className="mb-1 text-[9px] font-bold tracking-wider uppercase"
                        >
                          {item.category}
                        </Badge>
                      ) : null}
                      <p className="text-primary font-bold">{item.description}</p>
                    </td>
                    <td className="text-muted-foreground px-4 py-5 text-center font-mono font-medium">
                      {item.quantity}
                    </td>
                    <td className="text-muted-foreground px-4 py-5 text-right font-mono">
                      {formatMMK(Number(item.unitPrice))}
                    </td>
                    <td className="text-primary px-8 py-5 text-right font-mono font-bold">
                      {formatMMK(Number(item.totalPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/10 border-border/50 flex justify-end border-t p-8">
            <div className="w-72 space-y-4">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground tracking-wider uppercase">
                  Base Subtotal
                </span>
                <span className="text-primary font-mono">
                  {formatMMK(Number(quotation.subtotal))}
                </span>
              </div>
              {Number(quotation.discountAmount) > 0 && (
                <div className="flex justify-between text-xs font-bold text-red-500">
                  <span className="tracking-wider uppercase">Incentive Applied</span>
                  <span className="font-mono">-{formatMMK(Number(quotation.discountAmount))}</span>
                </div>
              )}
              <div className="border-primary/20 flex items-center justify-between border-t pt-4">
                <span className="text-accent text-[10px] font-black tracking-[0.2em] uppercase">
                  Final Total
                </span>
                <span className="text-primary text-2xl font-black tracking-tighter">
                  {formatMMK(Number(quotation.total))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Revision History Module */}
        {revisions && revisions.length > 0 && (
          <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
            <h3 className="text-accent mb-6 text-xs font-bold tracking-[0.2em] uppercase">
              Revision History
            </h3>
            <div className="relative border-l border-border pl-6 space-y-6">
              {revisions.map((rev) => {
                const isCurrent = rev.id === quotation.id;
                return (
                  <div key={rev.id} className="relative">
                    {/* Timeline Dot */}
                    <div
                      className={cn(
                        "absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 bg-background transition-colors",
                        isCurrent ? "border-amber-500 bg-amber-500/20" : "border-border",
                      )}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/quotations/${rev.id}`}
                            className={cn(
                              "font-bold hover:underline",
                              isCurrent ? "text-amber-500" : "text-primary",
                            )}
                          >
                            {rev.quoteNumber} (v{rev.revisionNumber})
                          </Link>
                          {isCurrent && (
                            <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[9px] px-1.5 py-0.5">
                              Current
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] font-semibold uppercase">
                            {rev.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs mt-1">
                          Revised on {format(new Date(rev.createdAt), "MMM dd, yyyy 'at' hh:mm a")}
                        </p>
                        {rev.revisionReason && (
                          <p className="text-muted-foreground text-xs italic mt-1.5 bg-muted/30 border border-border/40 rounded-lg p-2">
                            &ldquo;{rev.revisionReason}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preview Sidebar Bento */}
      <div className="col-span-12 space-y-6 lg:col-span-4">
        <div className="hidden lg:block">
          <QuotePreview />
        </div>
        {quotation.notes && (
          <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
            <h3 className="text-accent mb-4 text-xs font-bold tracking-[0.2em] uppercase">
              Internal Notes
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed italic">
              &quot;{quotation.notes}&quot;
            </p>
          </div>
        )}
      </div>

      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Revise Quotation</DialogTitle>
            <DialogDescription>
              Create a new draft revision of this quotation. Please provide a reason for the
              revision.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Revision Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Adjusted discount, added accessories..."
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevisionDialogOpen(false);
                setRevisionReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevise}
              disabled={isPending || !revisionReason.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isPending ? "Creating..." : "Create Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
